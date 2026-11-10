package com.todo.plan;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.todo.session.TimeSessionRepository;
import com.todo.todo.Todo;
import com.todo.todo.TodoRepository;
import com.todo.user.User;
import com.todo.user.UserRepository;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * 每天 04:00 把考研计划里的「今天」写进 todolist。
 *
 * <p>以前是本地双击 {@code 02_一键联动.cmd} 跑 {@code tools/todo-sync/import-plan.mjs}：
 * 计划文件和 token 都在用户的电脑上，电脑不开就不刷新。现在计划文件只读挂载进后端容器，
 * 由这里直接改数据库 —— 不依赖任何一台终端，也不需要 token（token 30 天会过期）。
 *
 * <p>口径与本地脚本一致：
 * <ul>
 *   <li>每个科目根合集下只保留一条常驻子任务「科目：短标题」
 *   <li>预算 = 计划里的 minutes；planDate 换天时预算随之归零
 *   <li>换天看 planDate，凌晨 4 点前仍算前一天；同一天重跑保留已勾状态
 *   <li>科目没任务（休息日 / 考试日）不建、不更新、不重置
 * </ul>
 *
 * <p>没配 {@code app.plan.file} / {@code app.plan.username} 时整体关闭，
 * 只在启动日志里说一声，不报错。
 */
@Component
public class PlanSyncJob {

    private static final Logger log = LoggerFactory.getLogger(PlanSyncJob.class);

    /** 和前端 studyDayKey、同步脚本 studyDateKey 同一口径 */
    static final int STUDY_DAY_START_HOUR = 4;

    /** 服务器容器默认是 UTC，日期与触发时刻都按东八区算 */
    static final ZoneId ZONE = ZoneId.of("Asia/Shanghai");

    /** 计划里的科目名 -> todolist 根合集名。改名的话在这里改。 */
    private static final Map<String, String> ROOTS = Map.of(
            "数学", "数学", "408", "408", "英语", "英语", "政治", "政治");

    /** 旧格式任务前缀（「今日计划｜11-09｜…」），第一次同步会就地改名 */
    private static final String DAILY_TASK_LABEL = "今日计划";

    private final TodoRepository todoRepository;
    private final TimeSessionRepository sessionRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;
    private final String planFile;
    private final String username;

    public PlanSyncJob(
            TodoRepository todoRepository,
            TimeSessionRepository sessionRepository,
            UserRepository userRepository,
            ObjectMapper objectMapper,
            @Value("${app.plan.file:}") String planFile,
            @Value("${app.plan.username:}") String username) {
        this.todoRepository = todoRepository;
        this.sessionRepository = sessionRepository;
        this.userRepository = userRepository;
        this.objectMapper = objectMapper;
        this.planFile = planFile == null ? "" : planFile.trim();
        this.username = username == null ? "" : username.trim();
        if (this.planFile.isEmpty() || this.username.isEmpty()) {
            log.info("[plan] 未配置计划文件 / 账号，每日计划同步关闭");
        } else {
            log.info("[plan] 每日计划同步已启用：{} -> 账号 {}", this.planFile, this.username);
        }
    }

    @Scheduled(cron = "${app.plan.cron:0 0 4 * * *}", zone = "Asia/Shanghai")
    @Transactional
    public void syncDaily() throws IOException {
        sync(Instant.now());
    }

    /** 拆出来便于按指定时刻验证；写操作都在同一个事务里，失败整批回滚 */
    void sync(Instant now) throws IOException {
        if (planFile.isEmpty() || username.isEmpty()) return;

        Path path = Path.of(planFile);
        if (!Files.isRegularFile(path)) {
            log.warn("[plan] 计划文件不存在：{}，跳过", path);
            return;
        }

        PlanFile plan = objectMapper.readValue(
                Files.readString(path, StandardCharsets.UTF_8), PlanFile.class);
        if (plan.schemaVersion() != 1) {
            log.warn("[plan] plan_days.json 的 schemaVersion 是 {}，只支持 1，跳过", plan.schemaVersion());
            return;
        }

        String date = studyDateKey(now.toEpochMilli());
        Day day = plan.days().stream()
                .filter((d) -> date.equals(d.date()))
                .findFirst()
                .orElse(null);
        if (day == null) {
            log.warn("[plan] 计划文件里没有 {} 这一天，跳过", date);
            return;
        }

        List<Subject> active = day.subjects().stream().filter(Subject::active).toList();
        if (active.isEmpty()) {
            log.info("[plan] {} 没有计划任务（休息日或考试日），未做改动", date);
            return;
        }

        User user = userRepository.findByUsername(username).orElse(null);
        if (user == null) {
            log.warn("[plan] 账号 {} 不存在，跳过", username);
            return;
        }

        Long uid = user.getId();
        long nowMs = now.toEpochMilli();
        List<Todo> todos = todoRepository.findByUserIdOrderBySortOrderAscCreatedAtAsc(uid);

        for (Subject subject : active) {
            String rootName = ROOTS.getOrDefault(subject.name(), subject.name());
            Todo root = todos.stream()
                    .filter((t) -> t.getParentId() == null && rootName.equals(t.getText()))
                    .findFirst()
                    .orElse(null);
            if (root == null) {
                root = new Todo(
                        UUID.randomUUID().toString(), uid, rootName, null,
                        nextSortOrder(todos, null), false, null, null, nowMs, nowMs);
                todoRepository.save(root);
                todos.add(root);
                log.info("[plan] 新建根合集「{}」", rootName);
            }

            String newText = rootName + "：" + shortTitle(subject.text());
            Long plannedMs = subject.minutes() != null && subject.minutes() > 0
                    ? subject.minutes() * 60_000L
                    : null;
            String budgetNote = plannedMs != null ? subject.minutes() + " 分" : "无预算";

            Todo existing = findDailyTask(todos, root.getId(), rootName);
            if (existing == null) {
                // 有了子事项就不再自己计时：根合集上还挂着的会话先结束（保留历史）
                endRunning(uid, root.getId());
                Todo created = new Todo(
                        UUID.randomUUID().toString(), uid, newText, root.getId(),
                        nextSortOrder(todos, root.getId()), false, plannedMs, date, nowMs, nowMs);
                todoRepository.save(created);
                todos.add(created);
                log.info("[plan] 「{}」新建：{}（预算 {}）", rootName, newText, budgetNote);
                continue;
            }

            boolean sameDay = Objects.equals(existing.getPlanDate(), date);
            boolean changed = false;
            if (!newText.equals(existing.getText())) {
                existing.setText(newText);
                changed = true;
            }
            if (!sameDay) {
                existing.setCompleted(false);
                existing.setCompletedAt(null);
                existing.setPlanDate(date);
                // 换了预算周期，提醒标记一并清掉，否则新预算用完也不会再提醒
                existing.setBudgetNotifiedAt(null);
                changed = true;
            }
            if (plannedMs != null && !plannedMs.equals(existing.getPlannedMs())) {
                existing.setPlannedMs(plannedMs);
                existing.setBudgetNotifiedAt(null);
                changed = true;
            }
            if (changed) {
                existing.setUpdatedAt(nowMs);
                todoRepository.save(existing);
                log.info("[plan] 「{}」更新：{}（预算 {}）{}",
                        rootName, newText, budgetNote, sameDay ? "" : "（已重置勾选）");
            } else {
                log.info("[plan] 「{}」已是最新：{}（预算 {}）", rootName, newText, budgetNote);
            }
        }
    }

    /**
     * 任务名用「科目：短标题」—— 列表里一行放得下。
     *
     * <p>和 {@code tools/todo-sync/import-plan.mjs} 的 shortTitle 保持一致：
     * 去掉「本周目标（第x/5天）：」这类前缀，再取第一个分句，超长截断。
     */
    static String shortTitle(String text) {
        String body = text == null ? "" : text.trim();
        body = body.replaceFirst("^[^：]*?（第\\d+/\\d+天）：", "").trim();
        int colon = body.indexOf('：');
        int semi = body.indexOf('；');
        int cut = colon == -1 ? semi : (semi == -1 ? colon : Math.min(colon, semi));
        String head = (cut == -1 ? body : body.substring(0, cut)).trim();
        String s = head.length() >= 2 ? head : body;
        return s.length() > 30 ? s.substring(0, 30) + "…" : s;
    }

    /** 学习日日期键：凌晨 4 点前仍算前一天 */
    static String studyDateKey(long ts) {
        return Instant.ofEpochMilli(ts - STUDY_DAY_START_HOUR * 3_600_000L)
                .atZone(ZONE)
                .toLocalDate()
                .toString();
    }

    /** 常驻子任务：新格式「科目：…」，或旧格式「今日计划｜11-09｜…」（第一次跑就地改名） */
    private Todo findDailyTask(List<Todo> todos, String rootId, String rootName) {
        String oldPrefix = DAILY_TASK_LABEL + "｜";
        return todos.stream()
                .filter((t) -> rootId.equals(t.getParentId()))
                .filter((t) -> t.getText() != null
                        && (t.getText().startsWith(rootName + "：") || t.getText().startsWith(oldPrefix)))
                .findFirst()
                .orElse(null);
    }

    /** 分组内当前最大位次 + 1；parentId 为 null 表示顶层 */
    private static int nextSortOrder(List<Todo> todos, String parentId) {
        return todos.stream()
                .filter((t) -> Objects.equals(t.getParentId(), parentId))
                .map(Todo::getSortOrder)
                .filter(Objects::nonNull)
                .mapToInt(Integer::intValue)
                .max()
                .orElse(-1) + 1;
    }

    private void endRunning(Long uid, String todoId) {
        sessionRepository.findFirstByUserIdAndTodoIdAndEndIsNull(uid, todoId).ifPresent((s) -> {
            s.setEnd(System.currentTimeMillis());
            sessionRepository.save(s);
        });
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record PlanFile(int schemaVersion, List<Day> days) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Day(String date, List<Subject> subjects) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Subject(String name, boolean active, Integer minutes, String text) {}
}
