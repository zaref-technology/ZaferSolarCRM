<div align="center">
  <img src="public/logo.png" alt="VR CRM Logo" width="120" />
  <h1>VR CRM</h1>
  <p><strong>A professional Solar Business CRM — built for speed, clarity, and scale.</strong></p>

  <p>
    <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white" />
    <img src="https://img.shields.io/badge/Vite-8-646CFF?style=for-the-badge&logo=vite&logoColor=white" />
    <img src="https://img.shields.io/badge/Firebase-Realtime-FFCA28?style=for-the-badge&logo=firebase&logoColor=black" />
    <img src="https://img.shields.io/badge/TailwindCSS-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" />
    <img src="https://img.shields.io/badge/Deployed-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white" />
  </p>
</div>

---

## 📸 Screenshots

### 🏠 Dashboard
![Dashboard](public/demo%20imgs%20/dashbord.png)

### 📋 Lead Management
![Leads](public/demo%20imgs%20/leads.png)

### 👤 Clients
![Clients](public/demo%20imgs%20/client.png)

### 📄 Quotation Builder
![Quotation Builder](public/demo%20imgs%20/Quotation.png)

### 📬 Send Quotation
![Send Quotation](public/demo%20imgs%20/Send-Quotation.png)

### 🖨️ PDF Preview
![PDF Preview](public/demo%20imgs%20/pdfpreview.png)

### ⚙️ Settings
![Settings](public/demo%20imgs%20/setting.png)

---

## ✨ Features

### 🎯 Lead Management
- Add, edit, delete, and track leads through a full sales pipeline
- Inline status updates with a dynamic dropdown
- Bulk CSV/XLSX import with smart field mapping
- One-click call dialing from the lead table
- Merge duplicate leads to keep data clean
- Export leads to Excel/CSV instantly

### 👥 Client Management
- Convert qualified leads into clients in one step
- Group projects per client with a 5-stage pipeline:
  `Survey → Design → Installation → Commissioning → Completed`
- Per-project activity log with chronological timeline
- Payment milestone tracking per project

### 📄 Quotation System
- Dynamic quotation generator supporting:
  - **1 kW Solar System**
  - **3 kW Solar System**
  - **5 kW Solar System**
  - **Solar Water Heater**
- Real-time PDF preview inside a modal
- One-click PDF generation & email sending
- Custom "About Us" and "Expertise" content injection
- Professional branded templates with company logo

### 📊 Dashboard Analytics
- Live KPI cards (Total Leads, Clients, Revenue, Conversions)
- Interactive bar & area charts (Recharts)
- Recent activity feed
- Top performing leads at a glance

### ⚙️ Settings
- Manage company profile (name, logo, address, contact)
- Salesperson / team member management
- App-wide configuration stored in Firebase

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend Framework | React 19 + Vite 8 |
| Styling | Tailwind CSS v4 |
| Animation | Framer Motion |
| Icons | Lucide React + Heroicons |
| Backend / Auth | Firebase (Firestore + Auth) |
| PDF Generation | jsPDF + jsPDF-AutoTable |
| Drag & Drop | @hello-pangea/dnd |
| Charts | Recharts |
| Excel Import | SheetJS (xlsx) |
| Notifications | React Hot Toast |
| Routing | React Router DOM v7 |
| Deployment | Vercel |

---

## 🚀 Getting Started

### Prerequisites
- Node.js **≥ 18**
- npm **≥ 9**
- A Firebase project with Firestore & Authentication enabled

### 1. Clone the repository
```bash
git clone https://github.com/SkAltmash/VR-CRM.git
cd VR-CRM
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the root directory and add your Firebase credentials:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### 4. Run the development server
```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### 5. Build for production
```bash
npm run build
```

---

## 📁 Project Structure

```
VR-CRM/
├── public/
│   ├── logo.png                  # Company logo
│   ├── demo imgs/                # Screenshot assets
│   └── Quotation/                # Quotation template images
├── src/
│   ├── Pages/
│   │   ├── Home.jsx              # Dashboard
│   │   ├── Leads.jsx             # Lead management
│   │   ├── Clients.jsx           # Client & project management
│   │   ├── QuotationTemplates.jsx# Quotation templates list
│   │   ├── Settings.jsx          # App settings
│   │   └── Login.jsx             # Authentication
│   ├── components/
│   │   ├── Navbar.jsx            # Top navigation bar
│   │   ├── Sidebar.jsx           # Side navigation
│   │   ├── LeadModal.jsx         # Add/edit lead form
│   │   ├── ViewLeadModal.jsx     # Lead detail view
│   │   ├── AddClientModal.jsx    # Add/edit client form
│   │   ├── ViewClientModal.jsx   # Client detail + projects
│   │   ├── ConvertLeadModal.jsx  # Lead → Client conversion
│   │   ├── BulkImportModal.jsx   # CSV/XLSX bulk import
│   │   ├── MergeDuplicatesModal.jsx # Merge duplicate leads
│   │   ├── TemplateModal.jsx     # Quotation template editor
│   │   ├── QuotationPreviewModal.jsx # PDF preview & generator
│   │   ├── PaymentModal.jsx      # Payment tracking
│   │   └── ProtectedRoute.jsx    # Auth guard
│   ├── context/                  # React Context providers
│   ├── utils/                    # Helper utilities
│   ├── App.jsx                   # Root component + routing
│   └── main.jsx                  # Entry point
├── firebase.js                   # Firebase config & init
├── vercel.json                   # Vercel deployment config
├── vite.config.js                # Vite configuration
└── package.json
```

---

## 🔐 Authentication

VR CRM uses **Firebase Authentication** with email/password login. All routes are protected via `ProtectedRoute.jsx`. Unauthorized users are redirected to the login page automatically.

---

## ☁️ Deployment

The project is configured for **zero-config Vercel deployment**:

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

The `vercel.json` handles SPA routing rewrites automatically.

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'feat: add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📄 License

This project is proprietary software. All rights reserved © VR Solar.

---

<div align="center">
  <p>Built with ❤️ for <strong>VR Solar</strong></p>
  <p>
    <a href="https://github.com/SkAltmash/VR-CRM">GitHub</a> •
    <a href="https://vr-crm.vercel.app">Live Demo</a>
  </p>
</div>
# ZaferSolarCRM
