#!/usr/bin/env bash
# TETO installer for Linux — works on any distro.
# - Removes any previously installed TETO first (clean update)
# - Installs the latest release (.deb / .rpm / AppImage)
# - Adds a desktop entry so TETO shows up in your app launcher (Super key search)
# Usage: curl -fsSL https://miyo-stream.tetocreations.bond/install.sh | bash
set -euo pipefail

REPO="TetoCreations/TETO-STREAM"
API="https://api.github.com/repos/${REPO}/releases/latest"
SITE="https://miyo-stream.tetocreations.bond"

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
info() { printf '\033[36m==>\033[0m %s\n' "$1"; }
warn() { printf '\033[33m==>\033[0m %s\n' "$1"; }
err()  { printf '\033[31mError:\033[0m %s\n' "$1" >&2; exit 1; }

command -v curl >/dev/null 2>&1 || err "curl is required. Install it with your package manager first."

bold "TETO installer"

# ---------------------------------------------------------------------------
# 1. Remove ALL previous TETO installations (any install method)
# ---------------------------------------------------------------------------
info "Removing previous TETO installations (if any)..."

# Old distro packages (deb-based)
if command -v dpkg >/dev/null 2>&1; then
  for pkg in miyo TETO miyo-stream; do
    if dpkg -s "$pkg" >/dev/null 2>&1; then
      warn "Removing old package: $pkg"
      sudo apt-get remove -y "$pkg" >/dev/null 2>&1 || sudo dpkg -r "$pkg" >/dev/null 2>&1 || true
    fi
  done
fi
# Old distro packages (rpm-based)
if command -v rpm >/dev/null 2>&1; then
  for pkg in miyo TETO miyo-stream; do
    if rpm -q "$pkg" >/dev/null 2>&1; then
      warn "Removing old package: $pkg"
      if command -v dnf >/dev/null 2>&1; then sudo dnf remove -y "$pkg" >/dev/null 2>&1 || true
      elif command -v zypper >/dev/null 2>&1; then sudo zypper --non-interactive remove "$pkg" >/dev/null 2>&1 || true
      else sudo rpm -e "$pkg" >/dev/null 2>&1 || true; fi
    fi
  done
fi
# Old AppImages and desktop entries from previous runs of this script
rm -f "${HOME}/.local/bin/TETO.AppImage" \
      "${HOME}/.local/bin/miyo" \
      "${HOME}/Applications/TETO.AppImage" \
      "${HOME}/.local/share/applications/miyo.desktop" \
      "${HOME}/.local/share/icons/hicolor/512x512/apps/miyo.png" 2>/dev/null || true

# ---------------------------------------------------------------------------
# 2. Fetch the latest release
# ---------------------------------------------------------------------------
info "Fetching latest release info..."
JSON="$(curl -fsSL "$API")" || err "Could not reach GitHub. Check your internet connection."
TAG="$(printf '%s' "$JSON" | grep -o '"tag_name": *"[^"]*"' | head -1 | sed 's/.*"tag_name": *"\([^"]*\)".*/\1/')"
[ -n "$TAG" ] && info "Latest version: $TAG"

asset_url() {
  printf '%s' "$JSON" | grep -o '"browser_download_url": *"[^"]*"' | sed 's/.*"browser_download_url": *"\([^"]*\)".*/\1/' | grep -i "$1" | head -1
}

# Pick the best package format for this system
PKG_TYPE="appimage"
if command -v dpkg >/dev/null 2>&1 && command -v apt-get >/dev/null 2>&1; then
  PKG_TYPE="deb"
elif command -v rpm >/dev/null 2>&1 && { command -v dnf >/dev/null 2>&1 || command -v zypper >/dev/null 2>&1 || command -v yum >/dev/null 2>&1; }; then
  PKG_TYPE="rpm"
fi

# ---------------------------------------------------------------------------
# 3. Install
# ---------------------------------------------------------------------------
case "$PKG_TYPE" in
  deb)
    URL="$(asset_url '\.deb$')"
    [ -n "$URL" ] || err "No .deb found in the latest release."
    info "Detected Debian/Ubuntu — downloading .deb package..."
    TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
    curl -fL --progress-bar "$URL" -o "$TMP/miyo.deb"
    info "Installing (requires sudo)..."
    sudo apt-get install -y "$TMP/miyo.deb" || sudo dpkg -i "$TMP/miyo.deb"
    ;;
  rpm)
    URL="$(asset_url '\.rpm$')"
    [ -n "$URL" ] || err "No .rpm found in the latest release."
    info "Detected Fedora/RHEL/openSUSE — downloading .rpm package..."
    TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
    curl -fL --progress-bar "$URL" -o "$TMP/miyo.rpm"
    info "Installing (requires sudo)..."
    if command -v dnf >/dev/null 2>&1; then sudo dnf install -y "$TMP/miyo.rpm"
    elif command -v zypper >/dev/null 2>&1; then sudo zypper --non-interactive install "$TMP/miyo.rpm"
    else sudo rpm -i "$TMP/miyo.rpm"; fi
    ;;
  appimage)
    URL="$(asset_url '\.appimage$')"
    [ -n "$URL" ] || err "No AppImage found in the latest release."
    info "Using universal AppImage (works on any distro)..."
    APP_DIR="${HOME}/.local/bin"
    mkdir -p "$APP_DIR"
    curl -fL --progress-bar "$URL" -o "$APP_DIR/TETO.AppImage"
    chmod +x "$APP_DIR/TETO.AppImage"

    # -----------------------------------------------------------------------
    # Desktop integration: icon + .desktop entry so TETO appears in the app
    # launcher / Super-key search on GNOME, KDE, XFCE, Cinnamon, etc.
    # -----------------------------------------------------------------------
    info "Adding TETO to your app launcher..."
    ICON_DIR="${HOME}/.local/share/icons/hicolor/512x512/apps"
    DESKTOP_DIR="${HOME}/.local/share/applications"
    mkdir -p "$ICON_DIR" "$DESKTOP_DIR"
    curl -fsSL "${SITE}/logo.png" -o "$ICON_DIR/miyo.png" 2>/dev/null || true

    cat > "$DESKTOP_DIR/miyo.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=TETO
GenericName=Streaming App
Comment=Stream anime, movies and TV shows
Exec=${APP_DIR}/TETO.AppImage %U
Icon=miyo
Terminal=false
Categories=AudioVideo;Video;Player;
Keywords=miyo;stream;anime;movies;tv;
StartupWMClass=TETO
EOF
    chmod +x "$DESKTOP_DIR/miyo.desktop"
    # Refresh launcher caches where available
    command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true
    command -v gtk-update-icon-cache >/dev/null 2>&1 && gtk-update-icon-cache -f -t "${HOME}/.local/share/icons/hicolor" 2>/dev/null || true
    ;;
esac

bold "TETO ${TAG:-} installed!"
info "Press the Super key and search for \"TETO\" to launch it."
