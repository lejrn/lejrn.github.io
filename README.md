# GitHub Repository Showcase

A modern, responsive website built with Vite and vanilla JavaScript to showcase your major GitHub repositories.

## ✨ Features

- **Clean, Modern Design**: Professional layout with responsive design
- **GitHub API Integration**: Automatically fetches your repositories
- **Repository Cards**: Shows descriptions, languages, stars, and forks
- **Mobile-First**: Optimized for all device sizes
- **Fast Loading**: Built with Vite for optimal performance
- **Dark/Light Mode**: Automatically adapts to user preference

## �️ Roadmap

### ✅ Completed Features
- [x] Basic GitHub API integration for repository fetching
- [x] Responsive repository cards with stats
- [x] Mobile-first responsive design
- [x] Vite-based build system
- [x] Error handling for API rate limits
- [x] Repository filtering (non-forked, non-archived)
- [x] Clean, modern UI design
- [x] **Language Icons Upgrade** - Official VS Code language icons from vscode-icons repository
  - [x] Dynamic icon mapping implementation
  - [x] URL-based icon loading from vscode-icons GitHub repository
  - [x] Fallback mechanism for unsupported languages
  - [x] Icon caching for improved performance
  - [x] Support for Robot Framework, HCL, Terraform, Jupyter, CMake, and more

### 🚧 In Progress

### 🎯 Planned Features

#### Phase 1: Enhanced Language Support
- [x] Dynamic language icon mapping using vscode-icons ✅
- [x] Icon caching for improved performance ✅
- [x] Support for more programming languages ✅
- [x] Custom fallback icons for unknown languages ✅

#### Phase 2: User Experience Improvements
- [ ] Dark/Light mode toggle button
- [ ] Search and filter functionality for repositories
- [ ] Sorting options (by stars, forks, last updated, name)
- [ ] Repository categories/tags
- [ ] Lazy loading for better performance

#### Phase 3: Advanced Features
- [ ] GitHub authentication for higher API limits
- [ ] Repository details modal/page
- [ ] Contribution activity visualization
- [ ] Repository README preview
- [ ] Social sharing capabilities

#### Phase 4: Analytics & Insights
- [ ] Repository statistics dashboard
- [ ] Language distribution charts
- [ ] Commit activity visualization
- [ ] Star history graphs
- [ ] Fork network visualization

### 🔮 Future Considerations
- [ ] Multiple GitHub user support
- [ ] Organization repository showcase
- [ ] Integration with other Git platforms (GitLab, Bitbucket)
- [ ] Offline mode with cached data
- [ ] PWA (Progressive Web App) capabilities
- [ ] Custom themes and branding options

### 🐛 Known Issues & Technical Debt
- [ ] API rate limiting for unauthenticated requests
- [ ] Static language icons need dynamic replacement
- [ ] Limited repository filtering options
- [ ] No persistent user preferences

## �🚀 Quick Start

### 1. Configure Your GitHub Username

Edit `src/main.js` and replace the username:

```javascript
const GITHUB_USERNAME = 'YOUR_USERNAME'; // Replace with your actual GitHub username
```

### 2. (Optional) Add GitHub Personal Access Token

To avoid rate limits, add a GitHub Personal Access Token in `src/main.js`:

```javascript
const GITHUB_TOKEN = 'your_token_here'; // Optional but recommended
```

**To create a token:**
1. Go to [GitHub Settings → Personal Access Tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Give it a name like "Repo Showcase"
4. Select the `public_repo` scope (only needed for public repositories)
5. Copy the token and paste it in `main.js`

**Benefits:**
- Without token: 60 requests/hour
- With token: 5,000 requests/hour

### 3. Install Dependencies

```bash
npm install
```

### 4. Run Development Server

```bash
npm run dev
```

### 5. Build for Production

```bash
npm run build
```

## ⚠️ GitHub API Rate Limits

The GitHub API has rate limits for unauthenticated requests (60 requests/hour). If you see "Rate Limit Exceeded" errors:

### For Development:
1. **Wait**: Rate limits reset every hour
2. **Use a Token**: Add a GitHub personal access token (see GitHub API documentation)
3. **Cache Results**: The production site will cache API responses

### For Production:
- GitHub Pages serves static files, so no API limits apply
- The build process should run on GitHub Actions with proper token access

## 🌐 Deploy to GitHub Pages

### Option 1: Automatic Deployment (Recommended)

1. Push your code to a GitHub repository
2. Go to **Settings** → **Pages** in your repository
3. Set **Source** to "GitHub Actions"
4. The site will automatically deploy when you push to main branch

### Option 2: Manual Deployment

```bash
npm run build
# Then upload the 'dist' folder contents to your GitHub Pages
```

## ⚙️ Configuration

### Repository Filtering

The app automatically filters repositories to show:
- Only non-forked repositories
- Only non-archived repositories
- Sorted by stars, then by last updated
- Maximum of 12 repositories

### Customization

- **Colors**: Edit CSS custom properties in `src/style.css`
- **Layout**: Modify the grid and card layouts
- **API Limits**: Adjust the number of repos shown in `main.js`

## 🛠️ Built With

- **Vite** - Fast build tool and dev server
- **Vanilla JavaScript** - No heavy frameworks
- **CSS Grid & Flexbox** - Modern responsive layouts
- **GitHub API** - Repository data fetching

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](../../issues).

---

**Note**: Make sure to update the `GITHUB_USERNAME` constant in `src/main.js` with your actual GitHub username before deploying.
