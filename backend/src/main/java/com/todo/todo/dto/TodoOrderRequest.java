package com.todo.todo.dto;

import java.util.List;

/**
 * 重排一个分组内的事项。
 *
 * <p>{@code parentId} 为 null 表示排的是顶层事项，非 null 表示排某个合集的子任务 —— 两者不能混。
 *
 * <p>{@code orderedIds} 是**该分组全部事项**按新顺序排好的 id。前端在「进行中 / 已完成」这类
 * 筛选视图下拖动时，会先把可见子集的新顺序插回完整顺序再发过来，所以这里不需要知道筛选的事。
 */
public record TodoOrderRequest(String parentId, List<String> orderedIds) {}
