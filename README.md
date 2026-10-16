# 4PLAY — «Ну ты понял»

Взрослая iPhone-first PWA-игра для компании из четырёх человек от **AlterNative**.

## Режимы

- **Один iPhone** — полностью офлайн, телефон передаётся по кругу.
- **Комната · 4 iPhone** — каждый играет со своего iPhone через Supabase Realtime.

## Что уже работает

- 4 игрока / 2 команды;
- 156 карточек в 6 категориях;
- выбор категорий;
- 60-секундные раунды;
- запрещённые слова;
- очки и финальный результат;
- PWA + Service Worker + offline-кэш;
- realtime-комнаты: код, invite-link, Presence, синхронизация состояния, автоматическая передача роли ведущего;
- приватные роли экрана: объясняющий, угадывающий, соперники;
- GitHub Actions проверяет JavaScript и JSON на каждом push.

## Realtime

Для режима четырёх iPhone нужен Supabase Project URL и **Publishable key** в `supabase-config.js`. База данных не используется: участники синхронизируются через Presence, игровые события — через Broadcast.

## GitHub Pages

https://shrekerianez.github.io/alter-native-4play/
