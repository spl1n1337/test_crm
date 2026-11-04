# СтройCRM — объекты и задачи

Мини-CRM для строительной компании: постановщик ведёт объекты и задачи, исполнитель работает только со своими карточками. Стек: **Next.js + NestJS + Supabase**. UI — shadcn/ui.

## HOW TO RUN

1. Clone the repo and install dependencies:

```bash
git clone https://github.com/spl1n1337/test_crm.git
cd test_crm
npm install
npm install --prefix backend
```

2. Create a [Supabase](https://supabase.com) project. In the SQL Editor run `supabase/migrations/0001_init.sql`, then `supabase/migrations/0002_auth_notifications.sql` if you need approval flow, password-reset tokens, and object links in notifications.

3. In Authentication → Providers → Email turn **off** public sign-ups (`Enable sign ups`). Nest (and the seeder) create users. You can also disable Supabase confirm-email: we send mail ourselves over SMTP.

4. Copy `.env.example` to `.env` in the **repo root** and fill in the keys. Keep `service_role` in `.env` only — never in `NEXT_PUBLIC_*`. `.env` is gitignored. If SMTP/S3 are empty, registration shows the confirm link on screen and photo upload returns a clear error.

5. Start both processes:

```bash
npm run dev          # Next.js, http://localhost:3000
npm run dev:api      # NestJS,  http://localhost:3001
```

Open [http://localhost:3000](http://localhost:3000).

6. Run the seeder. It creates demo users (admin, assigner, two executors), 3 construction objects, and tasks in every status (`new`, `in_progress`, `review`, `accepted`, `rework`):

```bash
npm run seed
```

Seed logins:

| Role | Email | Password |
|---|---|---|
| Admin | admin@stroycrm.test | Admin12345 |
| Assigner | assigner@stroycrm.test | Assigner12345 |
| Executor | executor1@stroycrm.test | Executor12345 |
| Executor | executor2@stroycrm.test | Executor12345 |

Tests:

```bash
npm run test:all
```

## Деплой без оплаты

- **Фронт:** [Vercel](https://vercel.com) — импорт репозитория, root = корень проекта. Env: `NEXT_PUBLIC_*`, `API_INTERNAL_URL` (URL Nest).
- **API:** [Render](https://render.com) free web service, root directory `backend`. Env: все серверные ключи, `FRONTEND_URL`, `APP_URL`.
- **База:** Supabase free.

После деплоя: `NEXT_PUBLIC_WS_URL` = публичный URL Nest, `API_INTERNAL_URL` = тот же URL для rewrite `/api/*`.

## Как устроена система (для руководителя)

В системе три роли. **Постановщик** заводит стройки и задачи, назначает людей, принимает работу или возвращает её с комментарием. **Исполнитель** видит только свои задачи и только те стройки, где он занят: берёт задачу в работу и отправляет на проверку. **Администратор** может то же, что постановщик, плюс видит, кто сейчас в системе, закрывает доступ сотруднику и смотрит выполненные задачи.

Задача идёт по жёсткому маршруту: новая → в работе → на проверке → принята. С проверки её можно вернуть на доработку, но только с комментарием. Других переходов нет: даже если кто-то попытается «подкрутить» статус в обход экрана, база это отвергнет.

Каждая смена статуса записывается: кто, когда, откуда и куда, плюс комментарий. Эту ленту нельзя подделать, поправить или стереть через API.

Данные закрыты не картинкой на сайте, а правилами в самой базе. Исполнитель, который откроет базу напрямую, всё равно не прочитает чужие задачи. Секретный ключ администратора базы во фронт не попадает.

Регистрация с подтверждением почты есть, но новый человек всегда приходит как исполнитель. Роль постановщика выдаёт администратор. Почта уходит письмом через ваш Gmail SMTP.

Онлайн в админке и всплывающие уведомления идут по WebSocket (Nest): постановщику — смена статуса, исполнителю — новая задача, обоим — «до дедлайна 15 минут» и «срок вышел». Фото аватара (с обрезкой) и вложения в задачу складываются в S3.

## Решения и допущения

- В ТЗ открытая регистрация выключена. По расширению задания регистрация есть, но только через Nest, с письмом и ролью «исполнитель». В панели Supabase sign-ups лучше выключить.
- Добавлена роль **admin**: сидер создаёт её, админка не смешивается с обычным постановщиком.
- Исполнителем можно назначить только пользователя с ролью executor.
- Срок задачи необязателен. Напоминания 15 минут / истечение считает Nest каждую минуту и дублирует в таблицу уведомлений.
- Если SMTP ещё не заполнен, ссылка подтверждения показывается на экране регистрации (чтобы можно было проверить без почты).
- Если S3 ещё не заполнен, загрузка фото отвечает «хранилище не настроено», остальное приложение работает.
- Удаление объекта/задачи постановщиком снимает и историю этой задачи. Подделать или править историю через API нельзя.
- Публичный anon-ключ Supabase во фронте нужен для входа и запросов под своим пользователем. Правила RLS при этом всё равно действуют. `service_role` живёт только в Nest.
- Не успели / сознательно не делали: отдельный мобильный клиент (есть адаптивная вёрстка и нижнее меню), push в OS, полноценный CI на GitHub.

## Структура

```
src/                 Next.js UI (shadcn)
backend/            NestJS: auth/SMTP, S3, WebSocket, cron, seed
supabase/migrations  схема, RLS, машина статусов, история
```
