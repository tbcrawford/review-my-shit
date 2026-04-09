# review-my-shit — justfile
# Run `just` to see all available recipes.

set quiet

# Default: list all recipes
default:
    @just --list

# ── Dependencies ─────────────────────────────────────────────────────────────

# Install project dependencies
dependencies:
    bun install

# ── Compilation ───────────────────────────────────────────────────────────────

# Compile TypeScript and copy templates → dist/
assemble:
    bun run build

# Type-check without emitting output
compile:
    bun run typecheck

# ── Verification ──────────────────────────────────────────────────────────────

# Run tests once
test:
    bun run test

# Run tests in continuous mode
watch:
    bun run test:watch

# Run all verification: typecheck + tests
check: compile test

# ── Lifecycle ─────────────────────────────────────────────────────────────────

# Full build lifecycle: assemble + check
build: assemble check

# Remove compiled output
clean:
    rm -rf dist/

# Clean → reinstall dependencies → assemble
rebuild: clean dependencies assemble

# ── Run ───────────────────────────────────────────────────────────────────────

# Run the CLI from source without assembling first, pass args after --
# Usage: just run review local
run *args:
    bun run dev {{ args }}

# ── Distribution ──────────────────────────────────────────────────────────────

# Install rms commands into editor config dirs (requires prior assemble)
install:
    node dist/setup.js

# Assemble then install rms commands into editor config dirs
publish: assemble install

# ── Development ───────────────────────────────────────────────────────────────

# Assemble, link locally, and run the installer via bunx for dev testing
preview: assemble
    bun link
    bunx review-my-shit

# Unlink the local package when done previewing
unlink:
    bun unlink review-my-shit
