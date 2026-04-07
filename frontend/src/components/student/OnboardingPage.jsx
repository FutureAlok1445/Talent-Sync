import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, Send, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { chatbotService } from '../../services/chatbotService'
import { useToast } from '../shared/useToast'
import { useAuthStore } from '../../store/authStore'

const ASSISTANT_TYPING_DELAY_MS = 2000

const splitAssistantResponse = (text) => {
  if (!text || typeof text !== 'string') return []
  return text
    .split(/\n\s*\n/g)
    .map((part) => part.trim())
    .filter(Boolean)
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="mr-3 shrink-0">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-xl shadow-lg"
          style={{ background: 'linear-gradient(135deg, #FFE135, #FFB800)' }}
        >
          <span className="font-heading text-[10px] font-bold text-[#09090B]">TS</span>
        </div>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm px-4 py-3"
        style={{
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border)',
        }}
      >
        <motion.span
          animate={{ y: [0, -6, 0] }}
          transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
          className="h-1.5 w-1.5 rounded-full bg-(--text-muted) opacity-60"
        />
        <motion.span
          animate={{ y: [0, -6, 0] }}
          transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut", delay: 0.2 }}
          className="h-1.5 w-1.5 rounded-full bg-(--text-muted) opacity-60"
        />
        <motion.span
          animate={{ y: [0, -6, 0] }}
          transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut", delay: 0.4 }}
          className="h-1.5 w-1.5 rounded-full bg-(--text-muted) opacity-60"
        />
      </motion.div>
    </div>
  )
}

export default function OnboardingPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [messages, setMessages] = useState([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [assistantTyping, setAssistantTyping] = useState(false)
  const [profileComplete, setProfileComplete] = useState(false)
  const [sessionId, setSessionId] = useState(null)
  
  const messagesEndRef = useRef(null)
  const isMountedRef = useRef(true)
  const hasInitializedRef = useRef(false)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const pushAssistantMessages = async (reply, replace = false) => {
    const parts = splitAssistantResponse(reply)
    const assistantParts = parts.length ? parts : [reply || 'No response available.']

    if (replace && isMountedRef.current) {
      setMessages([])
    }

    for (let index = 0; index < assistantParts.length; index += 1) {
      if (!isMountedRef.current) return
      setAssistantTyping(true)
      await wait(ASSISTANT_TYPING_DELAY_MS)
      if (!isMountedRef.current) return

      const nextMessage = { role: 'assistant', content: assistantParts[index] }
      if (replace && index === 0) {
        setMessages([nextMessage])
      } else {
        setMessages((prev) => [...prev, nextMessage])
      }
      setAssistantTyping(false)
    }
  }

  useEffect(() => {
    if (hasInitializedRef.current) return
    hasInitializedRef.current = true

    const initializeOnboarding = async () => {
      try {
        if (isMountedRef.current) {
          setMessages([])
        }
        const result = await chatbotService.resetSession()
        if (result?.session_id && isMountedRef.current) {
          setSessionId(result.session_id)
        }

        const fallbackResponse =
          '👋 Welcome to TalentSync! I\'m your onboarding assistant. Let\'s build your profile to find the best job matches for you.\n\nNow let\'s talk about your skills.\n\nList your technical skills separated by commas (e.g., Python, React, SQL, Machine Learning).'
        const reply = result?.response || fallbackResponse
        await pushAssistantMessages(reply, true)
        if (isMountedRef.current) {
          setProfileComplete(Boolean(result?.profile_complete))
        }
      } catch {
        const fallbackResponse =
          '👋 Welcome to TalentSync! I\'m your onboarding assistant. Let\'s build your profile to find the best job matches for you.\n\nNow let\'s talk about your skills.\n\nList your technical skills separated by commas (e.g., Python, React, SQL, Machine Learning).'
        await pushAssistantMessages(fallbackResponse, true)
      }
    }

    initializeOnboarding()
  }, [])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, assistantTyping])

  const sendMessage = async (e) => {
    if (e) e.preventDefault()
    const text = message.trim()
    if (!text || loading || assistantTyping) return

    setLoading(true)
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setMessage('')

    try {
      const response = await chatbotService.sendMessage(text, sessionId)
      const reply = response?.response || 'No response available.'
      if (response?.session_id) {
        setSessionId(response.session_id)
      }

      await pushAssistantMessages(reply)
      const isComplete = Boolean(response?.profile_complete)
      setProfileComplete(isComplete)
      if (isComplete) {
        useAuthStore.getState().updateUser({ onboardingComplete: true })
      }
    } catch {
      await pushAssistantMessages('Something went wrong. Please try again.')
      toast.error('Could not send your message. Please retry.')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async () => {
    if (loading || assistantTyping) return

    setLoading(true)
    try {
      setMessages([])
      const result = await chatbotService.resetSession()
      if (result?.session_id) {
        setSessionId(result.session_id)
      }

      setProfileComplete(Boolean(result?.profile_complete))
      const fallbackResponse =
        '👋 Welcome to TalentSync! I\'m your AI career assistant. Let\'s build your profile to find the best job matches for you.\n\nNow let\'s talk about your skills.\n\nList your technical skills separated by commas (e.g., Python, React, SQL, Machine Learning).'
      const reply = result?.response || fallbackResponse

      await pushAssistantMessages(reply, true)
      toast.success('Started a fresh onboarding session.')
    } catch {
      setAssistantTyping(false)
      toast.error('Could not reset onboarding. Please retry.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-8 pb-12 w-full max-w-none">
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
      >
        <div>
          <h1 className="font-heading text-[28px] font-bold text-(--text-primary)">
            Profile Onboarding
          </h1>
          <p className="mt-1 font-sans text-[14px] text-(--text-secondary)">
            Chat with TalentSync AI to quickly build out your profile and get matched.
          </p>
        </div>
        <button
          onClick={handleReset}
          className="group flex items-center gap-2 rounded-xl bg-(--bg-subtle) px-4 py-2 font-heading text-[13px] font-semibold text-(--text-primary) border border-(--border) hover:border-(--border-strong) hover:bg-(--bg-card) transition-all shadow-sm"
          title="Restart Onboarding Session"
          type="button"
        >
          <RefreshCw size={14} className="transition-transform group-hover:rotate-180 duration-500" />
          <span>Restart</span>
        </button>
      </motion.header>

      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
        className="flex flex-col rounded-2xl border border-(--border) bg-(--bg-card) shadow-2xl overflow-hidden"
      >
        {/* Chat Area */}
        <div
          className="relative h-[500px] overflow-y-auto px-6 py-8 scroll-smooth"
          style={{ scrollbarWidth: 'none', background: 'var(--bg-base)' }}
        >
          {messages.length === 0 && !assistantTyping ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                className="flex h-16 w-16 items-center justify-center rounded-2xl mb-4"
                style={{
                  background: 'linear-gradient(135deg, rgba(255, 225, 53, 0.15), rgba(255, 184, 0, 0.08))',
                  border: '1px solid rgba(255, 225, 53, 0.2)',
                }}
              >
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg shadow-lg"
                  style={{ background: 'linear-gradient(135deg, #FFE135, #FFB800)' }}
                >
                  <span className="font-heading text-[12px] font-bold text-[#09090B]">TS</span>
                </div>
              </motion.div>
              <p className="text-[14px] font-medium text-(--text-muted)">Waking up AI assistant...</p>
            </div>
          ) : null}

          <div className="flex flex-col gap-6">
            <AnimatePresence initial={false}>
              {messages.map((item, index) => (
                <motion.div
                  key={`${item.role}-${index}`}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  className={`flex ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {item.role === 'assistant' && (
                    <div className="mr-3 shrink-0">
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-xl shadow-md"
                        style={{ background: 'linear-gradient(135deg, #FFE135, #FFB800)' }}
                      >
                        <span className="font-heading text-[10px] font-bold text-[#09090B]">TS</span>
                      </div>
                    </div>
                  )}

                  <div
                    className={`max-w-[80%] rounded-2xl px-5 py-3.5 text-[14px] leading-relaxed shadow-sm ${
                      item.role === 'user'
                        ? 'rounded-tr-sm'
                        : 'rounded-tl-sm'
                    }`}
                    style={
                      item.role === 'user'
                        ? {
                            background: 'linear-gradient(135deg, #FFE135, #FFB800)',
                            color: '#09090B',
                            fontWeight: 500,
                          }
                        : {
                            background: 'var(--bg-subtle)',
                            border: '1px solid var(--border)',
                            color: 'var(--text-primary)',
                          }
                    }
                  >
                    {item.content}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            <AnimatePresence>
              {assistantTyping && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                >
                  <TypingIndicator />
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={messagesEndRef} className="h-4" />
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t border-(--border) bg-(--bg-card) p-4 sm:p-5">
          <form onSubmit={sendMessage} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <input
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder={assistantTyping ? "TalentSync is typing..." : "Type your response..."}
                disabled={loading || assistantTyping}
                className="w-full rounded-[14px] border border-(--border) bg-(--bg-base) px-5 py-3.5 text-[14px] text-(--text-primary) placeholder:text-(--text-muted) transition-all focus:border-(--accent-yellow) focus:ring-2 focus:ring-(--accent-yellow)/20 focus:outline-none disabled:opacity-50"
              />
            </div>
            
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading || assistantTyping || !message.trim()}
              className="flex items-center justify-center gap-2 rounded-[14px] px-6 py-3.5 font-heading text-[14px] font-bold text-[#09090B] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
              style={{ background: 'linear-gradient(135deg, #FFE135, #FFB800)' }}
            >
              {loading ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  <span>Sending</span>
                </>
              ) : (
                <>
                  <span>Send</span>
                  <Send size={16} className="-mt-0.5" />
                </>
              )}
            </motion.button>
          </form>
        </div>
      </motion.div>

      <AnimatePresence>
        {profileComplete && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex justify-center"
          >
            <button
              type="button"
              onClick={() => {
                useAuthStore.getState().updateUser({ onboardingComplete: true })
                navigate('/student/dashboard')
              }}
              className="flex items-center gap-2 rounded-[14px] px-8 py-4 font-heading text-[15px] font-bold tracking-wide text-(--bg-base) transition-all hover:scale-105 shadow-xl hover:shadow-2xl"
              style={{ background: 'var(--text-primary)' }}
            >
              <Check size={18} />
              Go to your Dashboard
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="hidden" aria-hidden="true">
        <title>Profile Onboarding | TalentSync</title>
      </div>
    </div>
  )
}