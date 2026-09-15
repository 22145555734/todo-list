# 待办事项（学习计时版）

一个前后端分离的待办事项应用，支持多用户账号、按事项独立计时、学习统计图表，以及游戏化的等级与称号系统。数据保存在服务器 MySQL，登录后随时随地同步。

## 功能

- **多用户账号**：注册 / 登录（JWT 鉴权），每个账号数据相互隔离。
- **待办管理**：添加 / 编辑 / 删除 / 完成，按「全部 / 进行中 / 已完成」筛选，一键清除已完成。
- **独立计时**：每个事项可单独开始 / 暂停计时，记录在该领域投入的总时长，跨设备持久化。
- **学习统计**：柱状图展示每天 / 每周 / 每月各科目的独立时长与学习总时长，支持近 7 天 / 14 天 / 30 天 / 3 个月 / 一年及自定义日期范围。
- **等级与称号**：每个事项独立升级，共 500 级、累计 500 小时，进度条实时显示到下一级还需多久。

## 技术栈

**前端**

- React 18 + TypeScript 5
- Vite 5
- Tailwind CSS 4
- Vitest 2 + @testing-library/react

**后端**

- Java 21 + Spring Boot 3.3
- Spring Security + JWT（jjwt）
- Spring Data JPA + MySQL 8

## 快速开始

### 前端

```bash
npm install       # 安装依赖
npm run dev       # 启动开发服务器（默认 http://localhost:5173）
npm run build     # 类型检查 + 构建
npm test          # 运行测试
```

开发时后端 API 默认指向同源 `/api`，可通过 Vite 代理转发到 `http://localhost:8080`。

### 后端

```bash
cd backend
mvn spring-boot:run   # 需本地 MySQL，或通过环境变量指定连接
```

后端关键环境变量：`DB_URL`、`DB_USERNAME`、`DB_PASSWORD`、`JWT_SECRET`、`JWT_EXPIRATION_MS`。

## Docker 部署

```bash
# 1. 构建前端产物
npm run build

# 2. 准备密钥（不提交到仓库）
cat > .env <<'EOF'
MYSQL_ROOT_PASSWORD=<强密码>
MYSQL_PASSWORD=<强密码>
JWT_SECRET=<随机长字符串>
JWT_EXPIRATION_MS=604800000
EOF

# 3. 构建并启动（mysql + backend + frontend）
docker compose up --build -d
```

前端 nginx 监听 8310 端口并反向代理 `/api` 到后端容器；后端以 `-Xmx256m` 的精简内存运行，MySQL 关闭 binlog 与 performance_schema、缓冲池 128M，适配低内存服务器。

## 目录结构

```
src/                 # 前端
├── api.ts           # 后端 REST 接口封装
├── token.ts         # 登录凭证（token/用户名）存取
├── store.tsx        # 全局状态（鉴权 + todos + 计时会话）
├── Auth.tsx         # 登录 / 注册页
├── time.ts          # 时间分桶、统计聚合与格式化
├── level.ts         # 等级 / 称号系统（500 级，等差数列）
├── Stats.tsx        # 统计页（SVG 堆叠柱状图 + KPI + 图例 + 表格）
├── TodoList.tsx     # 待办列表（计时 + 等级进度条）
└── App.tsx          # 登录态 + 标签页导航（待办事项 / 学习统计）

backend/             # Spring Boot 后端
├── auth/            # 注册 / 登录 + JWT 签发校验 + 安全过滤链
├── user/            # 用户实体
├── todo/            # 待办 CRUD
├── session/         # 计时会话（开始 / 暂停 / 清零）
└── exception/       # 全局异常处理
```
