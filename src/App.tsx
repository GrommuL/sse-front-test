import React, { useState, useEffect, useRef, useCallback } from 'react'
import { MessageCircle, Users, UserPlus } from 'lucide-react'
import axios from 'axios'
const API_URL = 'http://45.153.68.230:8070/api/v1'

type AuthMode = 'credentials' | 'direct'
type MessageMode = 'regular' | 'broadcast' | 'direct'

const MAX_RETRIES = 3
const INITIAL_RETRY_DELAY = 1000

export const App = () => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [messages, setMessages] = useState<{ status: string; payload: string }[]>([])
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [directUsername, setDirectUsername] = useState('')
  const [directJwt, setDirectJwt] = useState('')
  const [newMessage, setNewMessage] = useState('')
  const [targetUsername, setTargetUsername] = useState('')
  const [recepientUsername, setRecepientUsername] = useState('')
  const [isLogin, setIsLogin] = useState(true)
  const [authMode, setAuthMode] = useState<AuthMode>('credentials')
  const [messageMode, setMessageMode] = useState<MessageMode>('regular')
  const [isConnecting, setIsConnecting] = useState(false)
  const [users, setUsers] = useState<{ hashedPhone: string; phone: string }[]>([])
  const eventSourceRef = useRef<EventSource | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  const retryCount = useRef(0)
  const retryDelay = useRef(INITIAL_RETRY_DELAY)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  console.log({
    DELAY: retryDelay.current,
    COUNT: retryCount.current,
    EVENT: eventSourceRef.current
  })
  const startSseConnection = useCallback(() => {
    // if (isConnecting || !token) return

    // setIsConnecting(true)

    const eventSource = new EventSource(`${API_URL}/sse/open-sse-stream/${token}`)

    eventSource.onopen = (event) => {
      console.log({ ON_OPEN: event })
      console.log('Подключено к SSE')
      setIsConnecting(false)
      retryCount.current = 0
      retryDelay.current = INITIAL_RETRY_DELAY
      setErrorMessage('')
    }

    eventSource.onerror = (error) => {
      console.error('Ошибка подключения SSE:', error)
      eventSource.close()

      // if (errorMessage === 'reconnect' && retryCount.current < MAX_RETRIES) {
      //   console.log('Попытка переподключения...')
      //   setTimeout(() => {
      //     console.log('Попытка переподключения... 13123')
      //     retryCount.current += 1
      //     retryDelay.current *= 2
      //     startSseConnection()
      //     setErrorMessage('')
      //   }, retryDelay.current)
      // } else {
      //   setErrorMessage('')
      //   // handleLogout()
      // }
      // setIsConnecting(false)

      // setTimeout(() => {
      //   startSseConnection()
      // }, 3000)
    }

    // eventSource.onerror = () => {
    //   console.log('Соединение потеряно, попытка переподключения...')
    //   eventSource.close()
    //   setIsConnecting(false)

    // }

    eventSource.onmessage = (event) => {
      const message: { status: string; payload: string } = JSON.parse(event.data)
      console.log(event)
      if (message.status === 'reconnect') {
        console.log('Сервер запросил переподключение...')
        setErrorMessage('reconnect')
        eventSource.close()
        eventSourceRef.current = null
        setTimeout(() => {
          console.log('Попытка переподключения... 13123')
          retryCount.current += 1
          retryDelay.current *= 2
          startSseConnection()
          setErrorMessage('')
        }, retryDelay.current)
      } else if (message.status === 'message') {
        setMessages((prevMessages) => [...prevMessages, message])
        console.log('Новое сообщение.', event.data)
      } else {
        console.log('Сообщение.', event.data)
        return
      }
    }

    eventSourceRef.current = eventSource
  }, [token])

  useEffect(() => {
    if (token && !eventSourceRef.current) {
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
    const endpoint = isLogin ? 'login' : 'register'

    try {
      const response = await axios.post(
        `${API_URL}/auth/${endpoint}`,
        { phone: username, password, fingerprint: username },
        { headers: { 'Content-Type': 'application/json' }, withCredentials: true }
      )

      if (response.data.access_token) {
        localStorage.setItem('token', response.data.access_token)
        localStorage.setItem('phone', username)
        setToken(response.data.access_token)
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
      eventSourceRef.current = null
    }
    localStorage.removeItem('token')
    localStorage.removeItem('phone')
    setToken(null)
    setMessages([])
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !token) return

    try {
      switch (messageMode) {
        case 'broadcast':
          await fetch(`${API_URL}/sse/send-message-for-all`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ message: newMessage })
          })
          break
        case 'direct': {
          if (!targetUsername.trim()) {
            alert('Пожалуйста, укажите имя получателя')
            return
          }
          const response = await fetch(`${API_URL}/sse/send-message-by-hash/auth`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              payload: newMessage,
              senderHash: recepientUsername,
              recipientHash: targetUsername,
              sentTime: new Date()
            })
          })

          const responseData = await response.json()

          if (responseData.status === 'no_sender_connection' || responseData.status === 'no_recipient_connection') {
            setErrorMessage('reconnect')
            if (eventSourceRef.current) {
              eventSourceRef.current.close()
              eventSourceRef.current = null
            }
            setTimeout(() => {
              console.log('Попытка переподключения... 13123')
              retryCount.current += 1
              retryDelay.current *= 2
              startSseConnection()
              setErrorMessage('')
            }, retryDelay.current)
          }
          console.log(responseData)
          break
        }
        default:
          await axios.post(
            `${API_URL}/send-message`,
            { message: newMessage },
            {
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
              }
            }
          )
      }
      setNewMessage('')
    } catch (error) {
      console.error('Error sending message:', error)
    }
  }

  const getUsers = async () => {
    const response = await axios(`${API_URL}/sse/users`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    })
    const currentUser = response.data.find((user) => user.phone === localStorage.getItem('phone'))
    setRecepientUsername(currentUser.hashedPhone)

    setUsers(response.data)
  }

  const disconnect = async () => {
    await fetch(`${API_URL}/sse/close-sse-connection/${recepientUsername}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    })
  }
  const closeConnection = () => {
    if (eventSourceRef.current) {
      console.log('CLOSING CONNECTION')
      eventSourceRef.current.close()
      disconnect()
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
          {!isConnecting && <span className='text-green-500 text-sm'>Подключено</span>}
          <button onClick={disconnect} className='bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600'>
            Отключиться
          </button>
          <button onClick={handleLogout} className='bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600'>
            Выйти
          </button>
          <button onClick={closeConnection} className='bg-yellow-500 text-white px-4 py-2 rounded hover:bg-red-600'>
            Закрыть SSE
          </button>
        </div>
      </div>
      <div className='flex-grow overflow-y-auto p-4 space-y-4'>
        <div className='flex flex-col gap-y-[20px]'>
          <code>
            <pre className='text-white text-[14px]'>{JSON.stringify(users, undefined, 2)}</pre>
          </code>
          <button onClick={getUsers} className='bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600'>
            Получить всех пользователей
          </button>
        </div>
        {messages.map((message, index) => (
          <div key={`${index}-${message.payload}`} className='bg-gray-700 rounded-lg p-3'>
            {/* <span className='font-bold text-indigo-300'>{message.author}: </span> */}
            <span className='text-white'>{message.payload}</span>
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
