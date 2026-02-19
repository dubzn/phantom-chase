# ============================================================
# Makefile - Soroban contract deployment & development
# ============================================================

SHELL := /bin/bash
.PHONY: help setup fund deploy-ultrahonk build-zk-hunt deploy-zk-hunt deploy update-env set-game-hub dev clean

# Config
CONFIG_DIR     := .config/stellar
RPC_URL        ?= http://localhost:8000/rpc
NETWORK_PASS   ?= Standalone Network ; February 2017
SOURCE         ?= default

ULTRAHONK_WASM := contracts/zk-hunt/ultrahonk_soroban_contract.wasm
ZK_HUNT_WASM   := target/wasm32v1-none/release/zk_hunt.wasm

# State files (track deployed contract IDs)
STATE_DIR      := .deploy
ULTRAHONK_ID_FILE := $(STATE_DIR)/ultrahonk_id
ZK_HUNT_ID_FILE   := $(STATE_DIR)/zk_hunt_id

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

$(STATE_DIR):
	@mkdir -p $(STATE_DIR)

# ---- Local network ----

setup: ## Start local Stellar container
	stellar container start local --limits unlimited

fund: ## Fund the deployer account via friendbot
	@ADDR=$$(stellar keys address $(SOURCE) --config-dir $(CONFIG_DIR)); \
	echo "Funding $$ADDR..."; \
	curl -sf "http://localhost:8000/friendbot?addr=$$ADDR" > /dev/null && \
		echo "Funded $$ADDR" || echo "Friendbot failed (may already be funded)"

# ---- Deploy ultrahonk ----

deploy-ultrahonk: $(STATE_DIR) ## Deploy ultrahonk contract (uses pre-compiled WASM)
	@echo "Deploying ultrahonk_soroban_contract..."
	@ID=$$(stellar contract deploy \
		--wasm $(ULTRAHONK_WASM) \
		--source $(SOURCE) \
		--rpc-url "$(RPC_URL)" \
		--network-passphrase "$(NETWORK_PASS)" \
		--config-dir $(CONFIG_DIR)); \
	echo "$$ID" > $(ULTRAHONK_ID_FILE); \
	echo "ultrahonk deployed: $$ID"

# ---- Build & deploy zk-hunt ----

update-zk-hunt-source: ## Update ultrahonk address in zk-hunt source
	@[ -f $(ULTRAHONK_ID_FILE) ] || (echo "ERROR: Deploy ultrahonk first (make deploy-ultrahonk)" && exit 1)
	@ID=$$(cat $(ULTRAHONK_ID_FILE)); \
	sed -i.bak "s|pub const ULTRAHONK_CONTRACT_ADDRESS: &str = \"[^\"]*\";|pub const ULTRAHONK_CONTRACT_ADDRESS: \&str = \"$$ID\";|" \
		contracts/zk-hunt/src/lib.rs; \
	rm -f contracts/zk-hunt/src/lib.rs.bak; \
	echo "Updated ULTRAHONK_CONTRACT_ADDRESS to $$ID"

build-zk-hunt: update-zk-hunt-source ## Build zk-hunt (isolates workspace)
	@echo "Building zk-hunt..."
	@sed -i.bak 's|members = \["contracts/\*"\]|members = ["contracts/zk-hunt"]|' Cargo.toml
	@cargo build --release --target wasm32v1-none -p zk-hunt || \
		(mv Cargo.toml.bak Cargo.toml && exit 1)
	@mv Cargo.toml.bak Cargo.toml
	@echo "Build complete: $(ZK_HUNT_WASM)"

deploy-zk-hunt: $(STATE_DIR) build-zk-hunt ## Build and deploy zk-hunt
	@echo "Deploying zk-hunt..."
	@ID=$$(stellar contract deploy \
		--wasm $(ZK_HUNT_WASM) \
		--source $(SOURCE) \
		--rpc-url "$(RPC_URL)" \
		--network-passphrase "$(NETWORK_PASS)" \
		--config-dir $(CONFIG_DIR) \
		-- --admin $(SOURCE)); \
	echo "$$ID" > $(ZK_HUNT_ID_FILE); \
	echo "zk-hunt deployed: $$ID"

# ---- Update frontend ----

update-env: ## Update .env with deployed contract IDs + dev wallet secret
	@[ -f $(ULTRAHONK_ID_FILE) ] || (echo "ERROR: Deploy ultrahonk first" && exit 1)
	@[ -f $(ZK_HUNT_ID_FILE) ] || (echo "ERROR: Deploy zk-hunt first" && exit 1)
	@UH=$$(cat $(ULTRAHONK_ID_FILE)); \
	ZH=$$(cat $(ZK_HUNT_ID_FILE)); \
	SECRET=$$(stellar keys show $(SOURCE) --config-dir $(CONFIG_DIR) 2>/dev/null || echo ""); \
	sed -i.bak "s|^PUBLIC_ZK_HUNT_CONTRACT_ID=.*|PUBLIC_ZK_HUNT_CONTRACT_ID=\"$$ZH\"|" .env; \
	sed -i.bak "s|^PUBLIC_ULTRAHONK_CONTRACT_ID=.*|PUBLIC_ULTRAHONK_CONTRACT_ID=\"$$UH\"|" .env; \
	if [ -n "$$SECRET" ]; then \
		sed -i.bak "s|^.*PUBLIC_DEV_SECRET_KEY=.*|PUBLIC_DEV_SECRET_KEY=\"$$SECRET\"|" .env; \
		echo ".env updated:"; \
		echo "  PUBLIC_DEV_SECRET_KEY=$$SECRET"; \
	else \
		echo ".env updated (no dev secret found for source '$(SOURCE)'):"; \
	fi; \
	rm -f .env.bak; \
	echo "  PUBLIC_ULTRAHONK_CONTRACT_ID=$$UH"; \
	echo "  PUBLIC_ZK_HUNT_CONTRACT_ID=$$ZH"

# ---- Full deploy pipeline ----

deploy: fund deploy-ultrahonk deploy-zk-hunt update-env ## Full deploy: fund + ultrahonk + zk-hunt + update .env
	@echo ""
	@echo "========================================="
	@echo "  Deploy complete!"
	@echo "========================================="
	@echo "  ultrahonk:  $$(cat $(ULTRAHONK_ID_FILE))"
	@echo "  zk-hunt:    $$(cat $(ZK_HUNT_ID_FILE))"
	@echo ""
	@echo "  Restart 'bun run dev' to pick up changes."

# ---- Game Hub ----

GAME_HUB_ADDRESS ?=

set-game-hub: ## Set Game Hub address on zk-hunt contract
	@[ -f $(ZK_HUNT_ID_FILE) ] || (echo "ERROR: Deploy zk-hunt first (make deploy-zk-hunt)" && exit 1)
	@[ -n "$(GAME_HUB_ADDRESS)" ] || (echo "ERROR: Set GAME_HUB_ADDRESS=<address>" && exit 1)
	@stellar contract invoke \
		--id $$(cat $(ZK_HUNT_ID_FILE)) \
		--source $(SOURCE) \
		--rpc-url "$(RPC_URL)" \
		--network-passphrase "$(NETWORK_PASS)" \
		--config-dir $(CONFIG_DIR) \
		-- set_game_hub \
		--game_hub "$(GAME_HUB_ADDRESS)"
	@echo "Game Hub address set to $(GAME_HUB_ADDRESS)"

# ---- Development ----

dev: ## Start dev server (vite + scaffold watch)
	bun run dev

clean: ## Remove build artifacts and deploy state
	rm -rf $(STATE_DIR)
	rm -rf target/wasm32v1-none
	@echo "Cleaned build artifacts and deploy state"
