import { Web3Provider } from "@ethersproject/providers"
import { Web3ReactProvider } from "@web3-react/core"
import React, { Suspense } from "react"
import ReactDOM from "react-dom/client"
import { AudioProvider } from "./context/AudioContext"

import { AccountProvider } from "./context/AccountContext"
import { SceneProvider } from "./context/SceneContext"
import { ViewProvider } from "./context/ViewContext"

import { SoundProvider } from "./context/SoundContext"

// import i18n (needs to be bundled ;))
import "./lib/localization/i18n"

import App from "./App"
import { LanguageProvider } from "./context/LanguageContext"

class AppErrorBoundary extends React.Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, errorInfo) {
    console.error("Character Studio startup error:", error, errorInfo)
  }

  render() {
    if (this.state.error) {
      return (
        <main style={{ padding: "2rem", color: "white", fontFamily: "sans-serif" }}>
          <h1>Character Studio could not start</h1>
          <pre>{this.state.error.stack || this.state.error.message}</pre>
        </main>
      )
    }

    return this.props.children
  }
}

const getLibrary = (provider) => {
  const library = new Web3Provider(provider)
  library.pollingInterval = 12000
  return library
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <AppErrorBoundary>
    <Web3ReactProvider getLibrary={getLibrary}>
      <AccountProvider>
        <LanguageProvider>
          <AudioProvider>
            <ViewProvider>
              <SceneProvider>
                <SoundProvider>
                  <Suspense fallback={<main style={{ padding: "2rem", color: "white", fontFamily: "sans-serif" }}>Loading Character Studio...</main>}>
                    <App />
                  </Suspense>
                </SoundProvider>
              </SceneProvider>
            </ViewProvider>
          </AudioProvider>
        </LanguageProvider>
      </AccountProvider>
    </Web3ReactProvider>
  </AppErrorBoundary>,
)
