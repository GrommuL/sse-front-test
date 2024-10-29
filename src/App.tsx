import { useEffect, useState, useRef } from 'react'

export const App = () => {
  const [messages, setMessages] = useState<string[]>([])
  const [nickName, setNickName] = useState('')
  const [messageToSend, setMessageToSend] = useState('')
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!nickName) return

    const eventSource = new EventSource(`url`)
    eventSourceRef.current = eventSource

    eventSource.onmessage = (event) => {
      const newMessage = event.data
      setMessages((prevMessages) => [...prevMessages, newMessage])
    }

    eventSource.onerror = () => {
      console.error('SSE connection error')
      eventSource.close()
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [nickName])

  const sendMessageForAll = async () => {
    try {
      await fetch('url/${nick}', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageToSend })
      })
      setMessageToSend('')
    } catch (error) {
      console.error('Error sending message to all:', error)
    }
  }

  return (
    <div className='sse-client-container'>
      <h2>SSE Client</h2>

      <div>
        <input type='text' placeholder='Enter your nickname' value={nickName} onChange={(e) => setNickName(e.target.value)} />
      </div>
      <div>
        <h3>Connected as: {nickName}</h3>

        <div>
          <input type='text' placeholder='Enter message' value={messageToSend} onChange={(e) => setMessageToSend(e.target.value)} />
          <button onClick={sendMessageForAll}>Send</button>
        </div>

        <div className='sse-client-messages'>
          <h4>Messages:</h4>
          <ul>
            {messages.map((msg, index) => (
              <li key={index}>{msg}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
