import React, {useEffect, useState} from 'react'
import API from '../api'

export default function Invites(){
  const [invites, setInvites] = useState([])

  useEffect(()=>{ fetchInvites() }, [])
  async function fetchInvites(){
    try{ const res = await API.get('/invites'); if(res.data.ok) setInvites(res.data.invites) }catch(e){ alert('Error') }
  }

  async function create(){
    try{ const res = await API.post('/invites'); if(res.data.ok){ alert('Invite created: ' + res.data.invite); fetchInvites() } }
    catch(e){ alert('Error creating invite: ' + (e.response?.data?.error || e.message)) }
  }

  return (
    <div style={{padding:10}}>
      <h2>Invites (admin)</h2>
      <button onClick={create}>Create Invite</button>
      <ul>
        {invites.map(i=> (<li key={i.id}>{i.token} — created_by:{i.created_by} used_by:{i.used_by}</li>))}
      </ul>
    </div>
  )
}
