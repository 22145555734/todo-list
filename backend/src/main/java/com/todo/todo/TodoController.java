package com.todo.todo;

import com.todo.todo.dto.TodoCreateRequest;
import com.todo.todo.dto.TodoDto;
import com.todo.todo.dto.TodoUpdateRequest;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/todos")
public class TodoController {

    private final TodoService todoService;

    public TodoController(TodoService todoService) {
        this.todoService = todoService;
    }

    @GetMapping
    public List<TodoDto> list() {
        return todoService.list();
    }

    @PostMapping
    public TodoDto create(@RequestBody TodoCreateRequest req) {
        return todoService.create(req);
    }

    @PatchMapping("/{id}")
    public TodoDto update(@PathVariable String id, @RequestBody TodoUpdateRequest req) {
        return todoService.update(id, req);
    }

    @DeleteMapping("/completed")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void clearCompleted() {
        todoService.clearCompleted();
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id) {
        todoService.delete(id);
    }
}
