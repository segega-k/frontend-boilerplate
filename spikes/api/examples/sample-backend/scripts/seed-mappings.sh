#!/usr/bin/env sh
# How the committed mappings were produced: scaffold + CLI edits, exactly what an agent (/errors-map) would run.
# Run from spikes/api (devtools.config.json points the CLI at examples/sample-backend) after `pnpm api:gen`.
# Re-running on the committed state fails on "Already mapped" (by design): delete src/mappings/*.json first.
set -e
cli() { node packages/devtools-core/src/cli.ts "$@"; }

cli errors:sync wallet
cli errors:sync auth

# health: used by the raw recovery ping, never shows UI
cli errors:set wallet getHealth ERR --type silent --no-support
cli errors:set wallet getHealth NET --type silent

# profile (foundation query): fatal states are handled by appStatus, not by surfaces
cli errors:add wallet getProfile --variants "401_/api/problems/unauthorized,403_/api/problems/user_blocked" --type silent --severity error
cli errors:set wallet getProfile 200 --type silent
cli errors:set wallet getProfile ERR --type modal --severity error --support --title somethingWentWrong --subtitle pleaseTryAgainLater
cli errors:set wallet getProfile NET --type modal --severity error --title noInternetConnection

# balances: page-load GET under PageQueryGuard
cli errors:add wallet getBalances --variants "403_/api/problems/user_blocked,503_/api/problems/maintenance" --type silent --severity error
cli errors:add wallet getBalances --variants "500_/api/problems/internal_error" --type modal --severity error --support \
  --title-en "The server is not responding" --title-ru "Сервер не отвечает" --subtitle pleaseTryAgainLater
cli errors:set wallet getBalances 200 --type silent
cli errors:set wallet getBalances ERR --type modal --severity error --support --title somethingWentWrong --subtitle pleaseTryAgainLater
cli errors:set wallet getBalances NET --type modal --severity error --title noInternetConnection

cli errors:add wallet getAsset --variants "404_/api/problems/asset_not_found" --type toast --severity error \
  --title-en "Asset not found" --title-ru "Актив не найден"
cli errors:set wallet getAsset 200 --type silent
cli errors:set wallet getAsset ERR --type toast --severity error --support --title somethingWentWrong
cli errors:set wallet getAsset NET --type toast --severity error --title noInternetConnection

# transfers: success is data too
cli errors:set wallet createTransfer 200 --type toast --severity success --title-en "Transfer sent" --title-ru "Перевод отправлен"
cli errors:add wallet createTransfer --variants "400_/api/problems/insufficient_balance" --type toast --severity error \
  --title-en "Not enough funds on the balance" --title-ru "Недостаточно средств на балансе"
cli errors:add wallet createTransfer --variants "400_/api/problems/amount_too_small" --type custom --severity error --params minAmount \
  --title-en "The minimum amount is {{minAmount}}" --title-ru "Минимальная сумма: {{minAmount}}"
cli errors:add wallet createTransfer --variants "409_/api/problems/duplicate_transfer" --type toast --severity warning \
  --title-en "This transfer has already been sent" --title-ru "Этот перевод уже отправлен"
cli errors:set wallet createTransfer ERR --type toast --severity error --support --title somethingWentWrong --subtitle pleaseTryAgainLater
cli errors:set wallet createTransfer NET --type toast --severity error --title noInternetConnection

cli errors:set wallet cancelTransfer 204 --type toast --severity success --title-en "Transfer cancelled" --title-ru "Перевод отменён"
cli errors:add wallet cancelTransfer --variants "404_/api/problems/transfer_not_found" --type toast --severity error \
  --title-en "Transfer not found" --title-ru "Перевод не найден"
# cancelTransfer ERR/NET stay as agent drafts (visible in errors:list --draft)

cli errors:add auth login --variants "400_/api/problems/invalid_credentials" --type custom --severity error \
  --title-en "Invalid login or password" --title-ru "Неверный логин или пароль"
cli errors:add auth login --variants "403_/api/problems/user_blocked" --type silent --severity error
cli errors:set auth login 200 --type silent
cli errors:set auth login ERR --type toast --severity error --support --title somethingWentWrong --subtitle pleaseTryAgainLater
cli errors:set auth login NET --type toast --severity error --title noInternetConnection

# refresh failures are handled by the 401 middleware (session clear), never by a surface
cli errors:add auth refresh --variants "401_/api/problems/refresh_token_expired" --type silent --severity error
cli errors:set auth refresh 200 --type silent
cli errors:set auth refresh ERR --type silent --no-support
cli errors:set auth refresh NET --type silent

cli api:mappings:gen
cli errors:check
