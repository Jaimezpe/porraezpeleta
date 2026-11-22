import {Download} from 'lucide-react'
import {getPredictionForParticipant,resolveMatchTeams} from '../lib/tournament'
import {STAGES} from '../lib/constants'

export function PredictionImage({snapshot, participantId}) {
  const prediction = getPredictionForParticipant(snapshot,participantId)
  if(!prediction) return null
  function download() {
    const person = snapshot.participants.find(p=>p.id===participantId)?.display_name || 'Participante'
    const context = {...snapshot,...prediction}
    const sections = snapshot.groups.map(group=>({
      title:group.name,
      lines:prediction.groupPicks.filter(p=>p.group_id===group.id).sort((a,b)=>a.position-b.position)
        .map(p=>p.position+'º '+(snapshot.teams.find(t=>t.id===p.team_id)?.name || 'Pendiente'))
    }))
    for(const stage of STAGES) {
      const matches = snapshot.matches.filter(m=>m.stage===stage.value)
      if(matches.length) sections.push({title:stage.label,lines:matches.map(m=>{
        const teams=resolveMatchTeams(m,context)
        const winner=prediction.knockoutPicks.find(p=>p.match_id===m.id)?.winner_team_id
        return teams.map(t=>t?.name || 'Pendiente').join('  ·  ')+'   →   '+(snapshot.teams.find(t=>t.id===winner)?.name || 'Pendiente')
      })})
    }
    sections.push({title:'Bota de Oro',lines:[snapshot.candidates.find(c=>c.id===prediction.awardPick?.candidate_id)?.name || prediction.awardPick?.custom_name || 'Pendiente']})
    const canvas=document.createElement('canvas')
    canvas.width=1100
    canvas.height=148+sections.reduce((h,s)=>h+68+32*s.lines.length,0)
    const ctx=canvas.getContext('2d')
    ctx.fillStyle='#fafbf8'; ctx.fillRect(0,0,canvas.width,canvas.height)
    ctx.fillStyle='#145842'; ctx.fillRect(0,0,1100,104)
    ctx.fillStyle='white'; ctx.font='bold 34px Georgia'; ctx.fillText(snapshot.competition.name,32,48,1036)
    ctx.font='22px sans-serif'; ctx.fillText('Porra de '+person,32,83,1036)
    let y=140
    for(const section of sections) {
      ctx.fillStyle='#145842'; ctx.font='bold 25px sans-serif'; ctx.fillText(section.title,32,y,1036)
      y+=36; ctx.fillStyle='#172621'; ctx.font='22px sans-serif'
      for(const line of section.lines){ctx.fillText(line,48,y,1000);y+=32}
      y+=32
    }
    const link=document.createElement('a')
    link.download=snapshot.competition.name+' - '+person+'.png'
    link.href=canvas.toDataURL('image/png'); link.click()
  }
  return <button type="button" className="secondary-button" onClick={download}><Download size={16}/> Descargar esquema</button>
}
