package com.todo.budget;

import com.todo.session.TimeSession;
import com.todo.session.TimeSessionRepository;
import com.todo.todo.Todo;
import com.todo.todo.TodoRepository;
import java.util.Objects;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * 预算到点的兜底扫描。
 *
 * <p>正常情况下前端自己会在倒计时归零那一刻停表，这条扫描管的是「页面关了 / 设备切走了」：
 * 会话一直挂着，累计时长早就超了预算。这里把它按预算那一刻**精确截断**
 * （{@code end = start + 剩余预算}，不是「现在」），统计才不会因为扫描间隔而虚高。
 *
 * <p>另外它也是预算用完提醒的唯一出口 —— 不管表是谁停的（前端还是这里），
 * 只要「已用 ≥ 预算」就发一条，靠 {@code budgetNotifiedAt} 防重复。
 *
 * <p>为什么不在前端直接发提醒：浏览器关掉就没人发了；而后端本来就有全部会话，
 * 顺手还能把超时的表停掉。两条路都要能用，所以允许两边都触发、由标记位收敛。
 */
@Component
public class BudgetWatcher {

    private static final Logger log = LoggerFactory.getLogger(BudgetWatcher.class);

    private final TimeSessionRepository sessionRepository;
    private final TodoRepository todoRepository;
    private final QqNotifier notifier;

    public BudgetWatcher(
            TimeSessionRepository sessionRepository,
            TodoRepository todoRepository,
            QqNotifier notifier) {
        this.sessionRepository = sessionRepository;
        this.todoRepository = todoRepository;
        this.notifier = notifier;
        if (!notifier.enabled()) {
            log.info("[budget] 未配置通知目录 / chatKey，预算到点只停表、不发提醒");
        }
    }

    @Scheduled(fixedDelayString = "${app.notify.sweep-ms:10000}", initialDelayString = "8000")
    @Transactional
    public void sweep() {
        long now = System.currentTimeMillis();
        stopOverdue(now);
        notifyExhausted(now);
    }

    /** 把超出预算的进行中会话截断在预算用尽的那一刻。 */
    private void stopOverdue(long now) {
        for (TimeSession s : sessionRepository.findByEndIsNull()) {
            Long planned = s.getPlannedMs();
            if (planned == null || planned <= 0) continue;
            // 客户端时钟可能超前，算出未来的 start；先跳过，等时间对上
            if (s.getStart() > now) continue;
            long before = spentBefore(s);
            // 开始这段时预算就已经用完了 —— 这是「继续学」另开的那一段，超出的时间照常累计，不截
            if (before >= planned) continue;
            long end = s.getStart() + (planned - before);
            if (now >= end) {
                s.setEnd(end);
                sessionRepository.save(s);
            }
        }
    }

    /** 同一归属周期内、这条会话之前已经用掉的时间。 */
    private long spentBefore(TimeSession s) {
        long sum = 0;
        for (TimeSession o : sessionRepository.findByUserIdAndTodoId(s.getUserId(), s.getTodoId())) {
            if (o.getEnd() == null) continue;                                   // 含正在跑的这一条，跳过
            if (!Objects.equals(o.getPlanDate(), s.getPlanDate())) continue;    // 只算同一个预算周期
            sum += o.getEnd() - o.getStart();
        }
        return sum;
    }

    /** 预算用完、还没提醒过的事项，各发一条。 */
    private void notifyExhausted(long now) {
        for (Todo t : todoRepository.findByPlannedMsIsNotNull()) {
            Long planned = t.getPlannedMs();
            if (planned == null || planned <= 0) continue;
            if (t.isCompleted() || t.getBudgetNotifiedAt() != null) continue;
            if (spent(t) < planned) continue;

            notifier.send(budgetText(t, planned), now);
            t.setBudgetNotifiedAt(now);
            todoRepository.save(t);
        }
    }

    private long spent(Todo t) {
        long sum = 0;
        for (TimeSession o : sessionRepository.findByUserIdAndTodoId(t.getUserId(), t.getId())) {
            if (o.getEnd() == null) continue;
            if (!Objects.equals(o.getPlanDate(), t.getPlanDate())) continue;
            sum += o.getEnd() - o.getStart();
        }
        return sum;
    }

    private static String budgetText(Todo t, long plannedMs) {
        long minutes = Math.max(1, Math.round(plannedMs / 60000.0));
        return "⏰ 「" + t.getText() + "」的 " + minutes + " 分钟预算用完了，回来确认一下";
    }
}
