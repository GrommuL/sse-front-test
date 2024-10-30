import React, { useState, useEffect, useRef, useCallback } from 'react'
import { MessageCircle, Users, UserPlus } from 'lucide-react'
import axios from 'axios'

const API_URL = 'http://localhost:8080/api/v1/sse'

type AuthMode = 'credentials' | 'direct'
type MessageMode = 'regular' | 'broadcast' | 'direct'

export const App = () => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [messages, setMessages] = useState<{ id: string; author: string; content: string }[]>([
    { id: '1', author: 'Пользователь 1', content: 'Привет' },
    { id: '2', author: 'Пользователь 2', content: 'Привет' }
  ])
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [directUsername, setDirectUsername] = useState('')
  const [directJwt, setDirectJwt] = useState('')
  const [newMessage, setNewMessage] = useState('')
  const [targetUsername, setTargetUsername] = useState('')
  const [isLogin, setIsLogin] = useState(true)
  const [authMode, setAuthMode] = useState<AuthMode>('credentials')
  const [messageMode, setMessageMode] = useState<MessageMode>('regular')
  const [isConnecting, setIsConnecting] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const lastEventId = localStorage.getItem('lastEventId')

  const startSseConnection = useCallback(
    // (lastEventId?: string) => {
    () => {
      if (isConnecting || !token) return

      setIsConnecting(true)

      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }

      // const url = `${API_URL}/open-sse-stream/${token}${lastEventId ? `?lastEventId=${lastEventId}` : ''}`

      const eventSource = new EventSource(`${API_URL}/open-sse-stream/${token}`, { withCredentials: true })

      eventSource.onmessage = (event) => {
        const message = JSON.parse(event.data)
        setMessages((prevMessages) => [...prevMessages, message])

        if (event.lastEventId) {
          localStorage.setItem('lastEventId', event.lastEventId)
        }
      }

      eventSource.onopen = () => {
        console.log('Подключено к SSE')
        setIsConnecting(false)
      }

      eventSource.onerror = () => {
        console.log('Соединение потеряно, попытка переподключения...')
        eventSource.close()
        setIsConnecting(false)

        setTimeout(() => {
          // const lastEventId = localStorage.getItem('lastEventId')
          startSseConnection()
        }, 3000)
      }

      eventSourceRef.current = eventSource
    },
    [token, isConnecting]
  )

  useEffect(() => {
    if (token) {
      // const lastEventId = localStorage.getItem('lastEventId')
      startSseConnection()
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [token, startSseConnection])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    const endpoint = isLogin ? '/login' : '/register'

    try {
      const response = await axios.post(`${API_URL}${endpoint}`, { username, password })
      if (response.data.token) {
        localStorage.setItem('token', response.data.token)
        setToken(response.data.token)
      }
    } catch (error) {
      console.error('Authentication error:', error)
    }
  }

  const handleDirectAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!directJwt || !directUsername) return

    try {
      localStorage.setItem('token', directJwt)
      localStorage.setItem('username', directUsername)
      setToken(directJwt)
    } catch (error) {
      console.error('Direct auth error:', error)
    }
  }

  const handleLogout = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }
    localStorage.removeItem('token')
    localStorage.removeItem('lastEventId')
    localStorage.removeItem('username')
    setToken(null)
    setMessages([])
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !token) return

    try {
      switch (messageMode) {
        case 'broadcast':
          await fetch(`${API_URL}/send-message-for-all`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify('СЮДА ПЕРЕДАВАТЬ ОБЪЕКТ СООБЩЕНИЯ')
          })
          break
        case 'direct':
          if (!targetUsername.trim()) {
            alert('Пожалуйста, укажите имя получателя')
            return
          }
          await fetch(`${API_URL}/send-message-by-name/${targetUsername}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify('СЮДА ПЕРЕДАВАТЬ ОБЪЕКТ СООБЩЕНИЯ')
          })
          break
        default:
          await axios.post(`${API_URL}/АДРЕС НА ОТПРАВКУ ПРОСТО СООБЩЕНИЯ КУДА-ТО`, 'СЮДА ПЕРЕДАВАТЬ ОБЪЕКТ СООБЩЕНИЯ', {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            }
          })
      }
      setNewMessage('')
    } catch (error) {
      console.error('Error sending message:', error)
    }
  }

  if (!token) {
    return (
      <div className='flex items-center justify-center min-h-screen bg-gray-800'>
        <div className='bg-gray-700 p-8 rounded-lg shadow-lg w-96'>
          <div className='flex justify-center mb-6 space-x-4'>
            <button
              onClick={() => setAuthMode('credentials')}
              className={`px-4 py-2 rounded ${
                authMode === 'credentials' ? 'bg-indigo-500 text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
              }`}
            >
              Логин/Регистрация
            </button>
            <button
              onClick={() => setAuthMode('direct')}
              className={`px-4 py-2 rounded ${authMode === 'direct' ? 'bg-indigo-500 text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'}`}
            >
              Ввести JWT
            </button>
          </div>

          {authMode === 'credentials' ? (
            <form onSubmit={handleAuth}>
              <h2 className='text-2xl font-bold mb-6 text-white text-center'>{isLogin ? 'Логин' : 'Регистрация'}</h2>
              <input
                type='text'
                placeholder='Username'
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className='w-full p-2 mb-4 bg-gray-600 text-white rounded'
                required
              />
              <input
                type='password'
                placeholder='Password'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className='w-full p-2 mb-6 bg-gray-600 text-white rounded'
                required
              />
              <button type='submit' className='w-full bg-indigo-500 text-white p-2 rounded hover:bg-indigo-600'>
                {isLogin ? 'Логин' : 'Регистрация'}
              </button>
              <button type='button' onClick={() => setIsLogin(!isLogin)} className='w-full mt-4 text-indigo-300 hover:text-indigo-100'>
                {isLogin ? 'Зарегистрироваться?' : 'Залогиниться?'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleDirectAuth}>
              <h2 className='text-2xl font-bold mb-6 text-white text-center'>Direct JWT Auth</h2>
              <input
                type='text'
                placeholder='Username'
                value={directUsername}
                onChange={(e) => setDirectUsername(e.target.value)}
                className='w-full p-2 mb-4 bg-gray-600 text-white rounded'
                required
              />
              <textarea
                placeholder='JWT Token'
                value={directJwt}
                onChange={(e) => setDirectJwt(e.target.value)}
                className='w-full p-2 mb-6 bg-gray-600 text-white rounded h-24 resize-none'
                required
              />
              <button type='submit' className='w-full bg-indigo-500 text-white p-2 rounded hover:bg-indigo-600'>
                Подключиться
              </button>
            </form>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className='flex flex-col h-screen bg-gray-800'>
      <div className='flex-none bg-gray-900 p-4 flex justify-between items-center'>
        <h1 className='text-white text-xl font-bold'>SSE тестируем</h1>
        <div className='flex items-center gap-2'>
          {isConnecting && <span className='text-yellow-500 text-sm'>Соединение...</span>}
          {!isConnecting && lastEventId && <span className='text-yellow-500 text-sm'>Канал связи установлен, Last-Event-ID: {lastEventId} </span>}
          <button onClick={handleLogout} className='bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600'>
            Выйти
          </button>
        </div>
      </div>
      <div className='flex-grow overflow-y-auto p-4 space-y-4'>
        {messages.map((message, index) => (
          <div key={message.id || index} className='bg-gray-700 rounded-lg p-3'>
            <span className='font-bold text-indigo-300'>{message.author}: </span>
            <span className='text-white'>{message.content}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSendMessage} className='flex-none bg-gray-700 p-4'>
        <div className='flex flex-col space-y-2'>
          <div className='flex items-center justify-end space-x-2 px-2'>
            <button
              type='button'
              onClick={() => setMessageMode('regular')}
              className={`flex items-center space-x-1 px-3 py-1 rounded ${
                messageMode === 'regular' ? 'bg-indigo-500 text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
              }`}
            >
              <MessageCircle size={16} />
              <span>Обычное</span>
            </button>
            <button
              type='button'
              onClick={() => setMessageMode('broadcast')}
              className={`flex items-center space-x-1 px-3 py-1 rounded ${
                messageMode === 'broadcast' ? 'bg-indigo-500 text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
              }`}
            >
              <Users size={16} />
              <span>Всем</span>
            </button>
            <button
              type='button'
              onClick={() => setMessageMode('direct')}
              className={`flex items-center space-x-1 px-3 py-1 rounded ${
                messageMode === 'direct' ? 'bg-indigo-500 text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
              }`}
            >
              <UserPlus size={16} />
              <span>Личное</span>
            </button>
          </div>
          <div className='flex space-x-2'>
            <div className='flex rounded-md overflow-hidden flex-grow'>
              <input
                type='text'
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={
                  messageMode === 'broadcast'
                    ? 'Написать сообщение всем...'
                    : messageMode === 'direct'
                    ? 'Написать личное сообщение...'
                    : 'Написать сообщение...'
                }
                className='flex-grow p-2 bg-gray-600 text-white focus:outline-none'
              />
              {messageMode === 'direct' && (
                <input
                  type='text'
                  value={targetUsername}
                  onChange={(e) => setTargetUsername(e.target.value)}
                  placeholder='Имя получателя'
                  className='w-40 p-2 bg-gray-600 text-white focus:outline-none border-l border-gray-700'
                />
              )}
              <button
                type='submit'
                className={`px-4 py-2 text-white ${
                  messageMode === 'broadcast'
                    ? 'bg-purple-500 hover:bg-purple-600'
                    : messageMode === 'direct'
                    ? 'bg-green-500 hover:bg-green-600'
                    : 'bg-indigo-500 hover:bg-indigo-600'
                }`}
              >
                Отправить
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
