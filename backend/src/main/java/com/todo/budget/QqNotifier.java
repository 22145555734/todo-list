package com.todo.budget;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 往 QQ 机器人约定的投递目录写一条通知（详见 qq-agent 的队列约定）。
 *
 * <p>两边在同一台机器上：backend 在容器里，机器人只监听宿主机回环，HTTP 够不着；
 * 于是改用文件队列 —— 不开放端口、不需要令牌，机器人离线时消息也不会丢。
 *
 * <p>格式约束（对方实现的）：
 * <ul>
 *   <li>目录下只认 {@code .json}，所以必须先写 {@code .tmp} 再改名，否则对方会读到半截文件
 *   <li>{@code chatKey} 白名单由对方把关，写错会被移进 {@code rejected/}
 *   <li>{@code expiresAt} 是毫秒时间戳，过期的会被丢弃而不是补发
 * </ul>
 *
 * <p>没配置目录或 chatKey 时整套功能静默关闭 —— 本地开发和没接机器人的部署不该报错。
 */
@Component
public class QqNotifier {

    private static final Logger log = LoggerFactory.getLogger(QqNotifier.class);

    /** 通知的语义寿命：晚了十分钟以上的学习提醒没有意义，宁可丢弃。 */
    private static final long EXPIRE_MS = 10 * 60 * 1000L;

    private final String inbox;
    private final String chatKey;

    public QqNotifier(
            @Value("${app.notify.inbox:}") String inbox,
            @Value("${app.notify.chat-key:}") String chatKey) {
        this.inbox = inbox == null ? "" : inbox.trim();
        this.chatKey = chatKey == null ? "" : chatKey.trim();
    }

    public boolean enabled() {
        return !inbox.isEmpty() && !chatKey.isEmpty();
    }

    /** 投递一条通知。写文件成功即视为「已交给机器人」，不重发。 */
    public void send(String text, long now) {
        if (!enabled()) return;
        try {
            Path dir = Path.of(inbox);
            Files.createDirectories(dir);
            String name = "todo-" + now + "-" + UUID.randomUUID() + ".json";
            Path tmp = dir.resolve(name + ".tmp");
            Path target = dir.resolve(name);
            String json = "{\"chatKey\":\"" + escape(chatKey)
                    + "\",\"text\":\"" + escape(text)
                    + "\",\"expiresAt\":" + (now + EXPIRE_MS) + "}";
            Files.writeString(tmp, json, StandardCharsets.UTF_8);
            try {
                Files.move(tmp, target, StandardCopyOption.ATOMIC_MOVE);
            } catch (AtomicMoveNotSupportedException e) {
                Files.move(tmp, target, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException | RuntimeException e) {
            log.warn("[notify] 写入通知目录失败（{}）：{}", inbox, e.toString());
        }
    }

    private static String escape(String s) {
        StringBuilder sb = new StringBuilder(s.length() + 8);
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"' -> sb.append("\\\"");
                case '\\' -> sb.append("\\\\");
                case '\n' -> sb.append("\\n");
                case '\r' -> sb.append("\\r");
                case '\t' -> sb.append("\\t");
                default -> {
                    if (c < 0x20) sb.append(String.format("\\u%04x", (int) c));
                    else sb.append(c);
                }
            }
        }
        return sb.toString();
    }
}
