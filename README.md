# 📦 ChatPorter — In-Memory ChatGPT Share Link Extractor

> A privacy-first, zero-footprint in-memory web application and data pipeline for extracting, viewing, searching, and exporting conversations from **ChatGPT** shared links (`chatgpt.com/share/...`) into `.md`, `.txt`, and `.json`.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)
[![Privacy First](https://img.shields.io/badge/Privacy-100%25%20In--Memory-emerald.svg)](#-privacy-architecture)

---

## 🎯 Overview

Shared Chat links from ChatGPT rely on client-side streaming hydration using OpenAI's **React Router / TurboStream** pointer-graph serialization. Standard web scrapers and browser extensions either fail completely or require uploading sensitive conversations to third-party cloud servers.

**ChatPorter** provides an ultra-fast, zero-footprint in-memory extraction engine that:
1. Performs direct in-memory HTTP stream fetching with browser fingerprint simulation.
2. Deserializes the pointer-based array graph in volatile RAM with recursive cycle-resolution.
3. Normalizes conversations into clean Markdown, Plain Text, and structured JSON with full formatting (code snippets, tables, blockquotes, timestamps).
4. Provides instant 1-click exports without saving a single byte to disk or databases.

---

## 🛡️ Privacy & Security Architecture

- **🔒 100% In-Memory Execution**: Conversations exist in volatile RAM only for the duration of the request.
- **🚫 Zero Database Logging**: No SQL, NoSQL, Redis, or disk storage of chat contents.
- **🛡️ Zero Third-Party Scraping Services**: Direct HTTP communication without proxy brokers or external analytics.
- **💾 Client-Side File Generation**: Generating `.txt`, `.md`, and `.json` files is handled natively in the browser via Blob APIs.

---

## ✨ Features

- **⚡ Blazing Fast (< 1s)**: Native in-memory deserialization eliminates headless browser latency.
- **🔍 Real-Time Search & Filtering**: Search across messages or filter by *All Turns*, *User*, or *ChatGPT*.
- **💻 Syntax-Highlighted Code Blocks**: High-contrast code containers with 1-click **Copy Code** buttons.
- **📦 Multi-Format Exporter**:
  - 📝 **Markdown (`.md`)**: GitHub-flavored Markdown with role badges and metadata.
  - 📄 **Plain Text (`.txt`)**: Formatted chronological transcript.
  - 🗂️ **JSON (`.json`)**: Full structured turn schema for ML/data pipelines.
  - 📋 **Copy to Clipboard**: Quick Markdown copying.

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**

### 2. Installation

```bash
# Clone the repository
git clone https://github.com/moses-om/chatporter.git

# Navigate into project directory
cd chatporter

# Install dependencies (Express & CORS)
npm install
```

### 3. Run Locally

```bash
# Start the web server
npm start
```

Open your browser at:
```
http://localhost:3002
```

---

## 🔌 API Reference

### `POST /api/extract`

#### Request Body
```json
{
  "url": "https://chatgpt.com/share/example-share-id-12345"
}
```

#### Response Example
```json
{
  "success": true,
  "title": "System Architecture & Development Notes",
  "create_time": "2026-08-14T01:00:00.000Z",
  "total_turns": 24,
  "share_url": "https://chatgpt.com/share/example-share-id-12345",
  "turns": [
    {
      "id": "msg-001",
      "role": "user",
      "role_label": "USER",
      "time": "2026-08-14T01:00:00.000Z",
      "content": "How do we design a zero-footprint in-memory parser?"
    },
    {
      "id": "msg-002",
      "role": "assistant",
      "role_label": "CHATGPT",
      "time": "2026-08-14T01:00:02.000Z",
      "content": "A zero-footprint in-memory parser processes raw streaming chunks directly in RAM..."
    }
  ]
}
```

---

## 📂 Project Structure

```
chatporter/
├── server.js              # In-memory TurboStream extraction backend
├── package.json           # Project metadata & dependencies
├── .gitignore             # Git ignore configuration
├── README.md              # Documentation & guide
└── public/
    ├── index.html         # High-trust Light/White UI
    ├── styles.css         # Modern design tokens & layout
    └── app.js             # Client state, search, Markdown parsing, Blob exports
```

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for details.

---

## 👤 Author

**Moses Otieno Omondi**  
- Portfolio: [https://mosesomondi.dev](https://mosesomondi.dev)  
- GitHub: [@moses-om](https://github.com/moses-om)  
- LinkedIn: [Moses Omondi](https://linkedin.com/in/mosesomondi-om)
