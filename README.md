# Audiolibri Editor

A modern, feature-rich web application for editing the JSON data of the Audiolibri project and submitting changes via GitHub pull requests.

## Screenshots

![]()

## ✨ Features

### Core Functionality
- 🔍 **Advanced Search & Filtering** - Search by title, author, or genre with real-time results
- ✏️ **Rich Text Editing** - Edit all item details including synopsis, duration, narrator, etc.
- 📊 **Statistics Dashboard** - View total, processed, pending, and modified items at a glance
- 🔄 **Real-time Validation** - Form validation with instant feedback
- 📄 **Pagination** - Handle large datasets efficiently with customizable page sizes

### Bulk Operations
- ✅ **Bulk Selection** - Select multiple items for batch operations
- 🔧 **Bulk Editing** - Modify genre, language, and processing status for multiple items
- 📤 **Multiple Export Formats** - Export data in JSON, CSV, or XML formats

### GitHub Integration
- 🔀 **Pull Request Creation** - Automatically create PRs with detailed change summaries
- 📝 **Smart Commit Messages** - Generate meaningful commit messages and PR descriptions
- 🌿 **Branch Management** - Create unique branches for each set of changes

### User Experience
- ⌨️ **Keyboard Shortcuts** - Quick access to common actions
- ↩️ **Undo Functionality** - Easily revert recent changes
- 🎨 **Modern UI** - Beautiful, responsive interface built with Bootstrap 5
- 📱 **Mobile Responsive** - Works seamlessly on all device sizes
- 🍞 **Toast Notifications** - Elegant feedback for user actions

## 🚀 Quick Start

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- GitHub personal access token with repo permissions

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/fabriziosalmi/audiolibri-editor.git
   cd audiolibri-editor
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment:**
   Create a `.env` file in the root directory:
   ```env
   GITHUB_TOKEN=your_github_token_here
   REPO_OWNER=fabriziosalmi
   REPO_NAME=audiolibri
   PORT=3000
   ```
   Replace `your_github_token_here` with your GitHub personal access token.

4. **Start the application:**
   ```bash
   npm start
   ```

5. **Open your browser:**
   Navigate to `http://localhost:3000`

## 🔧 Development

### Development Mode
Run with auto-restart on file changes:
```bash
npm run dev
```

### Available Scripts
- `npm start` - Start the production server
- `npm run dev` - Start development server with nodemon
- `npm run docker:build` - Build Docker image
- `npm run docker:run` - Run Docker container
- `npm run docker:compose` - Start with Docker Compose
- `npm run docker:stop` - Stop Docker Compose services

## 🐳 Docker Deployment

### Using Docker Compose (Recommended)
```bash
docker-compose up -d
```

### Using Docker directly
```bash
# Build the image
docker build -t audiolibri-editor .

# Run the container
docker run -p 3000:3000 --env-file .env audiolibri-editor
```

## 📚 Usage Guide

### Basic Editing
1. **Search for items** using the search bar or filters
2. **Click on an item** from the list to select it
3. **Edit the details** in the right panel
4. **Click "Update Item"** to save changes locally
5. **Use "Save Changes"** to create a pull request

### Bulk Operations
1. **Select multiple items** using the checkboxes
2. **Click "Bulk Edit"** in the navigation
3. **Choose fields to modify** and set new values
4. **Apply changes** to all selected items

### Export Data
1. **Click "Export"** in the navigation
2. **Choose format** (JSON, CSV, XML)
3. **Select data scope** (all, filtered, or modified only)
4. **Download** the generated file

### Keyboard Shortcuts
- `Ctrl/Cmd + F` - Focus search bar
- `Ctrl/Cmd + S` - Save changes (open PR modal)
- `Ctrl/Cmd + Z` - Undo last change

## 🏗️ Architecture

### Frontend
- **Bootstrap 5** - Modern, responsive UI framework
- **Font Awesome** - Comprehensive icon library
- **Vanilla JavaScript** - No framework dependencies, fast and lightweight

### Backend
- **Express.js** - Minimal web framework
- **Octokit** - GitHub API integration
- **Axios** - HTTP client for external API calls

### Data Flow
1. Application fetches data from GitHub repository
2. User makes changes through the web interface
3. Changes are tracked locally in the browser
4. When ready, changes are submitted via GitHub API
5. New branch is created and pull request is opened

## 🔐 Security

- Environment variables for sensitive data
- GitHub token validation on startup
- Input sanitization and validation
- No sensitive data stored in browser

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🐛 Troubleshooting

### Common Issues

**Port 3000 already in use:**
```bash
# Change port in .env file or kill existing process
PORT=3001 npm start
```

**GitHub API rate limits:**
- Ensure you're using a personal access token
- Check token permissions include 'repo' scope

**Docker permissions:**
```bash
# On Linux, you may need to run with sudo or add user to docker group
sudo docker-compose up -d
```

### Support

If you encounter issues:
1. Check the console for error messages
2. Verify environment variables are set correctly
3. Ensure GitHub token has proper permissions
4. Check network connectivity to GitHub API

## 📊 Performance

- **Pagination** - Handles large datasets efficiently
- **Lazy loading** - Only loads visible items
- **Debounced search** - Reduces API calls during typing
- **Local caching** - Stores data locally to minimize requests

---

Made with ❤️ for the Audiolibri project
