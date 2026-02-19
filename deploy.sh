#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# deploy.sh - Full deploy pipeline for ZK Hunt
#
# Steps:
#   0. Wait for local Stellar network
#   1. Fund deployer account
#   2. Compile Noir circuits & generate VKs
#   3. Deploy ultrahonk verifier contract
#   4. Update hardcoded ultrahonk address in zk-hunt source
#   5. Build zk-hunt contract
#   6. Deploy zk-hunt contract
#   7. Set verification keys on-chain
#   8. Generate TypeScript bindings
#   9. Update .env with contract IDs
# ============================================================

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_DIR="$PROJECT_DIR/.config/stellar"
ENV_FILE="$PROJECT_DIR/.env"

RPC_URL="${RPC_URL:-http://localhost:8000/rpc}"
NETWORK_PASSPHRASE="${NETWORK_PASSPHRASE:-Standalone Network ; February 2017}"
SOURCE="${SOURCE:-default}"
GAME_HUB_ADDRESS="${GAME_HUB_ADDRESS:-}"

ULTRAHONK_WASM="$PROJECT_DIR/contracts/zk-hunt/ultrahonk_soroban_contract.wasm"
ZK_HUNT_WASM="$PROJECT_DIR/target/wasm32v1-none/release/zk_hunt.wasm"

CIRCUITS_DIR="$PROJECT_DIR/circuits"
PUBLIC_CIRCUITS_DIR="$PROJECT_DIR/public/circuits"

# Required tool versions (must match frontend @noir-lang/noir_js and @aztec/bb.js)
REQUIRED_NARGO="1.0.0-beta.9"
REQUIRED_BB="0.87.0"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ---- Step 0: Wait for local network to be ready ----
wait_for_network() {
    info "Waiting for Stellar network to be ready..."
    local max_attempts=30
    local attempt=0
    while [ $attempt -lt $max_attempts ]; do
        if curl -sf "$RPC_URL" -X POST \
            -H 'Content-Type: application/json' \
            -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' \
            2>/dev/null | grep -q "healthy"; then
            info "Network is ready"
            return 0
        fi
        attempt=$((attempt + 1))
        echo -n "."
        sleep 2
    done
    echo ""
    error "Network not ready after ${max_attempts} attempts. Is 'stellar container start local' running?"
}

# ---- Step 1: Fund the deployer account ----
fund_account() {
    info "Funding deployer account..."
    local addr
    addr=$(stellar keys address "$SOURCE" --config-dir "$CONFIG_DIR" 2>/dev/null) \
        || error "Could not get address for identity '$SOURCE'. Check .config/stellar/identity/"

    local friendbot_url
    friendbot_url="${RPC_URL%/rpc}/friendbot?addr=$addr"

    local max_attempts=5
    local attempt=0
    while [ $attempt -lt $max_attempts ]; do
        if curl -sf "$friendbot_url" > /dev/null 2>&1; then
            info "Account funded: $addr"
            return 0
        fi
        attempt=$((attempt + 1))
        warn "Friendbot attempt $attempt/$max_attempts failed, retrying in 3s..."
        sleep 3
    done

    # Verify account actually exists on the network via Horizon
    local horizon_url="${RPC_URL%/rpc}"
    if curl -sf "$horizon_url/accounts/$addr" > /dev/null 2>&1; then
        warn "Friendbot failed but account already exists, continuing..."
        return 0
    fi

    error "Failed to fund account $addr after $max_attempts attempts. Is the local network running?"
}

# ---- Step 2: Compile Noir circuits & generate VKs ----
compile_circuits() {
    info "Compiling Noir circuits and generating verification keys..."
    mkdir -p "$PUBLIC_CIRCUITS_DIR"

    # Verify tool versions match frontend packages
    local nargo_ver
    nargo_ver=$(nargo --version 2>/dev/null | head -1 | sed 's/nargo version = //')
    if [ "$nargo_ver" != "$REQUIRED_NARGO" ]; then
        error "nargo version mismatch: got $nargo_ver, need $REQUIRED_NARGO. Run: noirup -v $REQUIRED_NARGO"
    fi

    local bb_ver
    bb_ver=$(bb --version 2>/dev/null | sed 's/^v//')
    if [ "$bb_ver" != "$REQUIRED_BB" ]; then
        error "bb version mismatch: got $bb_ver, need $REQUIRED_BB. Run: bbup -v $REQUIRED_BB"
    fi

    # Circuits that need compilation + VK generation (used for on-chain verification)
    local proof_circuits=("jungle_move" "search_response")

    # Circuits that only need compilation (executed client-side, no proof)
    local exec_circuits=("commitment")

    for circuit in "${exec_circuits[@]}"; do
        local circuit_dir="$CIRCUITS_DIR/$circuit"
        if [ ! -d "$circuit_dir/src" ]; then
            warn "Circuit $circuit has no source, skipping"
            continue
        fi
        info "Compiling $circuit..."
        (cd "$circuit_dir" && nargo compile)
        cp "$circuit_dir/target/${circuit}.json" "$PUBLIC_CIRCUITS_DIR/"
        info "$circuit compiled"
    done

    for circuit in "${proof_circuits[@]}"; do
        local circuit_dir="$CIRCUITS_DIR/$circuit"
        if [ ! -d "$circuit_dir/src" ]; then
            warn "Circuit $circuit has no source, skipping"
            continue
        fi
        info "Compiling $circuit..."
        (cd "$circuit_dir" && nargo compile)
        cp "$circuit_dir/target/${circuit}.json" "$PUBLIC_CIRCUITS_DIR/"

        info "Generating VK for $circuit..."
        bb write_vk --oracle_hash keccak --scheme ultra_honk --output_format fields \
            -b "$circuit_dir/target/${circuit}.json" \
            -o "$circuit_dir/target/vk_fields"

        # bb write_vk with --output_format fields creates: target/vk_fields/vk_fields.json
        local vk_file="$circuit_dir/target/vk_fields/vk_fields.json"
        [ -f "$vk_file" ] || error "VK fields file not found at $vk_file"

        # Copy JSON VK fields to public circuits dir (ultrahonk contract expects JSON array of hex strings)
        cp "$vk_file" "$PUBLIC_CIRCUITS_DIR/${circuit}_vk.json"

        info "$circuit VK generated"
    done

    info "All circuits compiled"
}

# ---- Step 3: Deploy ultrahonk contract ----
deploy_ultrahonk() {
    info "Deploying ultrahonk_soroban_contract..."

    [ -f "$ULTRAHONK_WASM" ] || error "WASM not found: $ULTRAHONK_WASM"

    ULTRAHONK_ID=$(stellar contract deploy \
        --wasm "$ULTRAHONK_WASM" \
        --source "$SOURCE" \
        --rpc-url "$RPC_URL" \
        --network-passphrase "$NETWORK_PASSPHRASE" \
        --config-dir "$CONFIG_DIR")

    info "ultrahonk deployed: $ULTRAHONK_ID"
}

# ---- Step 4: Update hardcoded address in zk-hunt ----
update_source() {
    local lib_rs="$PROJECT_DIR/contracts/zk-hunt/src/lib.rs"
    info "Updating ULTRAHONK_CONTRACT_ADDRESS in zk-hunt..."

    sed -i.bak "s|pub const ULTRAHONK_CONTRACT_ADDRESS: &str = \"[^\"]*\";|pub const ULTRAHONK_CONTRACT_ADDRESS: \&str = \"$ULTRAHONK_ID\";|" "$lib_rs"
    rm -f "${lib_rs}.bak"

    info "Updated lib.rs with new ultrahonk address"
}

# ---- Step 5: Build zk-hunt ----
build() {
    info "Building zk-hunt..."

    # Temporarily restrict workspace to only zk-hunt
    local cargo_toml="$PROJECT_DIR/Cargo.toml"
    sed -i.bak 's|members = \["contracts/\*"\]|members = ["contracts/zk-hunt"]|' "$cargo_toml"

    cargo build --release --target wasm32v1-none -p zk-hunt --manifest-path "$cargo_toml"

    # Restore workspace
    mv "${cargo_toml}.bak" "$cargo_toml"

    [ -f "$ZK_HUNT_WASM" ] || error "Build failed: $ZK_HUNT_WASM not found"
    info "zk-hunt built successfully"
}

# ---- Step 6: Deploy zk-hunt ----
deploy_zk_hunt() {
    info "Deploying zk-hunt..."

    ZK_HUNT_ID=$(stellar contract deploy \
        --wasm "$ZK_HUNT_WASM" \
        --source "$SOURCE" \
        --rpc-url "$RPC_URL" \
        --network-passphrase "$NETWORK_PASSPHRASE" \
        --config-dir "$CONFIG_DIR" \
        -- --admin "$SOURCE")

    info "zk-hunt deployed: $ZK_HUNT_ID"
}

# ---- Step 7: Set verification keys ----
set_vks() {
    info "Setting verification keys..."

    local move_vk="$PUBLIC_CIRCUITS_DIR/jungle_move_vk.json"
    local search_vk="$PUBLIC_CIRCUITS_DIR/search_response_vk.json"

    if [ ! -f "$move_vk" ] || [ ! -f "$search_vk" ]; then
        warn "VK files not found in public/circuits/. Skipping set_vks."
        warn "You'll need to compile circuits and run set_vks manually."
        return 0
    fi

    local move_vk_hex
    move_vk_hex=$(xxd -p "$move_vk" | tr -d '\n')
    local search_vk_hex
    search_vk_hex=$(xxd -p "$search_vk" | tr -d '\n')

    stellar contract invoke \
        --id "$ZK_HUNT_ID" \
        --source "$SOURCE" \
        --rpc-url "$RPC_URL" \
        --network-passphrase "$NETWORK_PASSPHRASE" \
        --config-dir "$CONFIG_DIR" \
        -- set_vks \
        --move_vk "$move_vk_hex" \
        --search_vk "$search_vk_hex"

    info "Verification keys set"
}

# ---- Step 7b: Set Game Hub address ----
set_game_hub() {
    if [ -z "$GAME_HUB_ADDRESS" ]; then
        warn "GAME_HUB_ADDRESS not set, skipping Game Hub configuration (local dev)."
        return 0
    fi

    info "Setting Game Hub address to $GAME_HUB_ADDRESS..."

    stellar contract invoke \
        --id "$ZK_HUNT_ID" \
        --source "$SOURCE" \
        --rpc-url "$RPC_URL" \
        --network-passphrase "$NETWORK_PASSPHRASE" \
        --config-dir "$CONFIG_DIR" \
        -- set_game_hub \
        --game_hub "$GAME_HUB_ADDRESS"

    info "Game Hub address set"
}

# ---- Step 8: Generate TypeScript bindings ----
generate_bindings() {
    info "Generating TypeScript bindings..."

    stellar contract bindings typescript \
        --wasm "$ULTRAHONK_WASM" \
        --output-dir "$PROJECT_DIR/packages/ultrahonk_soroban_contract" \
        --overwrite

    stellar contract bindings typescript \
        --wasm "$ZK_HUNT_WASM" \
        --output-dir "$PROJECT_DIR/packages/zk_hunt" \
        --overwrite

    # Fix: remove Timepoint import not exported by installed @stellar/stellar-sdk
    for pkg in ultrahonk_soroban_contract zk_hunt; do
        local idx="$PROJECT_DIR/packages/$pkg/src/index.ts"
        if [ -f "$idx" ]; then
            sed -i.bak '/^  Timepoint,$/d' "$idx"
            rm -f "${idx}.bak"
        fi
    done

    info "Building bindings packages..."
    (cd "$PROJECT_DIR" && npm install --workspace=packages && npm run build --workspace=packages)

    info "TypeScript bindings generated and built"
}

# ---- Step 9: Update .env ----

update_env() {
    info "Updating .env..."

    if [ ! -f "$ENV_FILE" ]; then
        warn ".env not found, creating from scratch"
        cat > "$ENV_FILE" <<EOF
STELLAR_SCAFFOLD_ENV=development
XDG_CONFIG_HOME=".config"
PUBLIC_ZK_HUNT_CONTRACT_ID="$ZK_HUNT_ID"
PUBLIC_ULTRAHONK_CONTRACT_ID="$ULTRAHONK_ID"
PUBLIC_STELLAR_NETWORK="LOCAL"
PUBLIC_STELLAR_NETWORK_PASSPHRASE="Standalone Network ; February 2017"
PUBLIC_STELLAR_RPC_URL="$RPC_URL"
PUBLIC_STELLAR_HORIZON_URL="${RPC_URL%/rpc}"
EOF
    else
        if grep -q "^PUBLIC_ZK_HUNT_CONTRACT_ID=" "$ENV_FILE"; then
            sed -i.bak "s|^PUBLIC_ZK_HUNT_CONTRACT_ID=.*|PUBLIC_ZK_HUNT_CONTRACT_ID=\"$ZK_HUNT_ID\"|" "$ENV_FILE"
        else
            echo "PUBLIC_ZK_HUNT_CONTRACT_ID=\"$ZK_HUNT_ID\"" >> "$ENV_FILE"
        fi
        sed -i.bak "s|^PUBLIC_ULTRAHONK_CONTRACT_ID=.*|PUBLIC_ULTRAHONK_CONTRACT_ID=\"$ULTRAHONK_ID\"|" "$ENV_FILE"
        rm -f "${ENV_FILE}.bak"
    fi

    info ".env updated"
}

# ---- Step 10: Print summary ----
print_summary() {
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  Deploy complete!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo "  ultrahonk:  $ULTRAHONK_ID"
    echo "  zk-hunt:    $ZK_HUNT_ID"
    echo ""
    echo "  Circuits compiled and VKs set on-chain."
    echo "  TypeScript bindings generated."
    echo "  .env and contract source updated."
    echo "  Restart 'bun run dev' to pick up changes."
    echo ""
}

# ---- Main ----
main() {
    cd "$PROJECT_DIR"

    echo ""
    echo -e "${GREEN}Deploying to: ${NC}$RPC_URL"
    echo -e "${GREEN}Source:        ${NC}$SOURCE"
    echo ""

    wait_for_network
    fund_account
    compile_circuits
    deploy_ultrahonk
    update_source
    build
    deploy_zk_hunt
    set_vks
    set_game_hub
    update_env
    generate_bindings
    print_summary
}

main "$@"
