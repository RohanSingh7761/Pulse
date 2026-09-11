CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hedera_account_id VARCHAR(100) UNIQUE,
    wallet_address VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(30) UNIQUE NOT NULL CHECK (username ~ '^[a-zA-Z0-9_]+$'),
    display_name VARCHAR(100), bio TEXT, avatar_url TEXT,
    reputation_score INTEGER NOT NULL DEFAULT 0 CHECK (reputation_score >= 0),
    role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','deleted')),
    auth_nonce TEXT, auth_nonce_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    headline VARCHAR(200), category VARCHAR(100), location VARCHAR(100), website_url TEXT, github_url TEXT,
    linkedin_url TEXT, twitter_url TEXT, verification_status VARCHAR(30) NOT NULL DEFAULT 'unverified'
      CHECK (verification_status IN ('unverified','pending','verified')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS person_markets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, symbol VARCHAR(20) UNIQUE NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending','active','paused','failed','closed')),
    token_id VARCHAR(100) UNIQUE, token_decimals SMALLINT NOT NULL DEFAULT 8 CHECK (token_decimals BETWEEN 0 AND 18),
    contract_address VARCHAR(255), contract_market_id BIGINT, hedera_network VARCHAR(20) NOT NULL DEFAULT 'testnet',
    current_price NUMERIC(38,18) NOT NULL DEFAULT 0 CHECK (current_price >= 0),
    circulating_supply NUMERIC(38,18) NOT NULL DEFAULT 0 CHECK (circulating_supply >= 0),
    reserve_balance NUMERIC(38,18) NOT NULL DEFAULT 0 CHECK (reserve_balance >= 0),
    total_volume NUMERIC(38,18) NOT NULL DEFAULT 0 CHECK (total_volume >= 0), holder_count INTEGER NOT NULL DEFAULT 0 CHECK (holder_count >= 0),
    creation_transaction_id VARCHAR(255), creation_status VARCHAR(30) NOT NULL DEFAULT 'pending'
      CHECK (creation_status IN ('pending','confirmed','failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS bonding_curves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), market_id UUID UNIQUE NOT NULL REFERENCES person_markets(id) ON DELETE CASCADE,
    curve_type VARCHAR(30) NOT NULL CHECK (curve_type IN ('linear')),
    base_price NUMERIC(38,18) NOT NULL CHECK (base_price >= 0), slope NUMERIC(38,18) NOT NULL CHECK (slope >= 0),
    max_supply NUMERIC(38,18) NOT NULL CHECK (max_supply > 0), protocol_fee_bps INTEGER NOT NULL DEFAULT 100 CHECK (protocol_fee_bps BETWEEN 0 AND 1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS holdings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    market_id UUID NOT NULL REFERENCES person_markets(id) ON DELETE CASCADE, token_balance NUMERIC(38,18) NOT NULL DEFAULT 0 CHECK (token_balance >= 0),
    average_entry_price NUMERIC(38,18) CHECK (average_entry_price >= 0), total_invested NUMERIC(38,18) NOT NULL DEFAULT 0 CHECK (total_invested >= 0), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, market_id)
);
CREATE TABLE IF NOT EXISTS trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id), market_id UUID NOT NULL REFERENCES person_markets(id),
    trade_type VARCHAR(10) NOT NULL CHECK (trade_type IN ('buy','sell')), status VARCHAR(20) NOT NULL DEFAULT 'prepared' CHECK (status IN ('prepared','submitted','confirmed','failed')),
    token_amount NUMERIC(38,18) NOT NULL CHECK (token_amount > 0), settlement_amount NUMERIC(38,18) NOT NULL CHECK (settlement_amount >= 0), execution_price NUMERIC(38,18) NOT NULL CHECK (execution_price >= 0),
    transaction_id VARCHAR(255) UNIQUE, idempotency_key VARCHAR(255) UNIQUE NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), confirmed_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS price_ticks (
    id BIGSERIAL PRIMARY KEY, market_id UUID NOT NULL REFERENCES person_markets(id) ON DELETE CASCADE, price NUMERIC(38,18) NOT NULL CHECK (price >= 0), supply NUMERIC(38,18) NOT NULL CHECK (supply >= 0), reserve_balance NUMERIC(38,18) NOT NULL CHECK (reserve_balance >= 0), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, title VARCHAR(200) NOT NULL, description TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','in_progress','completed','verified')), evidence_url TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS token_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id UUID NOT NULL REFERENCES person_markets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    title VARCHAR(200) NOT NULL,
    body TEXT NOT NULL,
    update_type VARCHAR(30) NOT NULL DEFAULT 'general'
        CHECK (update_type IN ('general','milestone','announcement','warning')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_markets_user_id ON person_markets(user_id);
CREATE INDEX IF NOT EXISTS idx_markets_status ON person_markets(status);
CREATE INDEX IF NOT EXISTS idx_holdings_market_id ON holdings(market_id);
CREATE INDEX IF NOT EXISTS idx_trades_market_created ON trades(market_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_ticks_market_created ON price_ticks(market_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_milestones_user_id ON milestones(user_id);
CREATE INDEX IF NOT EXISTS idx_token_updates_market ON token_updates(market_id, created_at DESC);

DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS markets_updated_at ON person_markets;
CREATE TRIGGER markets_updated_at BEFORE UPDATE ON person_markets FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS holdings_updated_at ON holdings;
CREATE TRIGGER holdings_updated_at BEFORE UPDATE ON holdings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS token_updates_updated_at ON token_updates;
CREATE TRIGGER token_updates_updated_at BEFORE UPDATE ON token_updates FOR EACH ROW EXECUTE FUNCTION set_updated_at();