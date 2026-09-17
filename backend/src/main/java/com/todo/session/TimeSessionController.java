package com.todo.session;

import com.todo.session.dto.AdoptTimeRequest;
import com.todo.session.dto.PauseRequest;
import com.todo.session.dto.SessionDto;
import com.todo.session.dto.StartRequest;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class TimeSessionController {

    private final TimeSessionService sessionService;

    public TimeSessionController(TimeSessionService sessionService) {
        this.sessionService = sessionService;
    }

    @GetMapping("/sessions")
    public List<SessionDto> list() {
        return sessionService.list();
    }

    @PostMapping("/todos/{id}/start")
    public SessionDto start(@PathVariable String id, @RequestBody StartRequest req) {
        return sessionService.start(id, req);
    }

    @PostMapping("/todos/{id}/pause")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void pause(@PathVariable String id, @RequestBody PauseRequest req) {
        sessionService.pause(id, req);
    }

    @PostMapping("/todos/{id}/adopt-time")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void adoptTime(@PathVariable String id, @RequestBody AdoptTimeRequest req) {
        sessionService.adoptTime(id, req);
    }
}
