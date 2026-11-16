#!/bin/sh
# 装在服务器 /usr/local/bin/mem-watch.sh，由 /etc/cron.d/mem-watch 每 5 分钟调用一次。
# mem-watch: 每 5 分钟记一次「谁在吃内存」，用来揪出长时间运行后把 1.6 GB 撑爆的那个进程。
# 2026-11-16 事故的教训：只看 free -m 知道「吃满了」，但事后没法回溯是谁涨的。
LOG=/var/log/mem-watch.log
MAX=5242880

if [ -f "$LOG" ] && [ "$(stat -c %s "$LOG")" -gt "$MAX" ]; then
  mv -f "$LOG" "$LOG.1"
fi

{
  echo "===== $(date '+%F %T') load=$(cut -d' ' -f1 /proc/loadavg)"
  free -m | head -3
  docker stats --no-stream --format '{{.Name}} {{.MemUsage}} {{.MemPerc}}' 2>/dev/null
  ps aux --sort=-rss | head -6 | awk '{printf "  %-10s %-7s %6.0f MB  %s\n", $1, $2, $6/1024, $11}'
} >> "$LOG" 2>&1
