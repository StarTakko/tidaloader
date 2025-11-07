#!/data/data/com.termux/files/usr/bin/bash

# Termux setup script for Tidal Troi UI
set -e

echo "Setting up Tidal Troi UI on Termux..."

# Install required packages
pkg update -y
pkg install -y python git nodejs-lts

# Create directories
mkdir -p ~/tidal-troi-ui
mkdir -p ~/music/tidal-downloads

# Clone repository if not exists
if [ ! -d ~/tidal-troi-ui/.git ]; then
    cd ~
    git clone https://github.com/RayZ3R0/tidal-troi-ui.git
fi

cd ~/tidal-troi-ui

# Backend setup
cd backend
python -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Create .env file
cat > .env << 'EOF'
# Music directory for Termux
MUSIC_DIR=/data/data/com.termux/files/home/music/tidal-downloads
EOF

cd ..

# Frontend setup
cd frontend
npm install
npm run build

cd ..

echo "Setup complete!"
echo "Run './start-service.sh' to start the service"