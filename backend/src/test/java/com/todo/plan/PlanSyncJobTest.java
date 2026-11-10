package com.todo.plan;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.Instant;
import org.junit.jupiter.api.Test;

/** 只测纯函数：换天口径和短标题与前端 / 本地脚本必须一致。 */
class PlanSyncJobTest {

    @Test
    void studyDateKey_凌晨四点前算前一天() {
        // 东八区 2026-11-09 23:59 / 11-10 03:59 都还是 11-09
        assertEquals("2026-11-09", PlanSyncJob.studyDateKey(Instant.parse("2026-11-09T15:59:00Z").toEpochMilli()));
        assertEquals("2026-11-09", PlanSyncJob.studyDateKey(Instant.parse("2026-11-09T19:59:00Z").toEpochMilli()));
    }

    @Test
    void studyDateKey_四点起算新的一天() {
        assertEquals("2026-11-10", PlanSyncJob.studyDateKey(Instant.parse("2026-11-09T20:00:00Z").toEpochMilli()));
        assertEquals("2026-11-10", PlanSyncJob.studyDateKey(Instant.parse("2026-11-10T04:00:00Z").toEpochMilli()));
    }

    @Test
    void shortTitle_去掉周目标前缀并取第一个分句() {
        assertEquals(
                "高数第1章 函数极限连续",
                PlanSyncJob.shortTitle("本周目标（第2/5天）：高数第1章 函数极限连续：李擂基础课 2-3 节 + 习题"));
    }

    @Test
    void shortTitle_英文分号也算分句() {
        assertEquals("Unit 2 的 20 个词", PlanSyncJob.shortTitle("Unit 2 的 20 个词；长难句 2 句"));
    }

    @Test
    void shortTitle_超长截断() {
        String longText = "做 `每日题目.md` 数学 1–8 题（ε-δ/ε-N 定义与数列极限）";
        String title = PlanSyncJob.shortTitle(longText);
        assertEquals(31, title.length());
        assertEquals("…", title.substring(title.length() - 1));
    }

    @Test
    void shortTitle_没有分句时保留整段() {
        assertEquals("数据结构第1章 绪论 + 第2章 线性表",
                PlanSyncJob.shortTitle("数据结构第1章 绪论 + 第2章 线性表"));
    }
}
