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
    const rounds=STAGES.map(stage=>({...stage,matches:snapshot.matches.filter(m=>m.stage===stage.value)})).filter(stage=>stage.matches.length)
    const bracketHeight=rounds.length ? 64+Math.max(...rounds.map(stage=>stage.matches.length))*92 : 0
    sections.push({title:'Bota de Oro',lines:[snapshot.candidates.find(c=>c.id===prediction.awardPick?.candidate_id)?.name || prediction.awardPick?.custom_name || 'Pendiente']})
    const canvas=document.createElement('canvas')
    canvas.width=Math.max(1100,rounds.length*320+64)
    canvas.height=148+bracketHeight+sections.reduce((h,s)=>h+68+32*s.lines.length,0)
    const ctx=canvas.getContext('2d')
    ctx.fillStyle='#fafbf8'; ctx.fillRect(0,0,canvas.width,canvas.height)
    ctx.fillStyle='#145842'; ctx.fillRect(0,0,canvas.width,104)
    ctx.fillStyle='white'; ctx.font='bold 34px Georgia'; ctx.fillText(snapshot.competition.name,32,48,1036)
    ctx.font='22px sans-serif'; ctx.fillText('Porra de '+person,32,83,1036)
    let y=140
    for(const section of sections) {
      ctx.fillStyle='#145842'; ctx.font='bold 25px sans-serif'; ctx.fillText(section.title,32,y,1036)
      y+=36; ctx.fillStyle='#172621'; ctx.font='22px sans-serif'
      for(const line of section.lines){ctx.fillText(line,48,y,1000);y+=32}
      y+=32
    }
    const locations=new Map()
    rounds.forEach((stage,col)=>{
      const x=32+320*col
      ctx.fillStyle='#145842'; ctx.font='bold 23px sans-serif'; ctx.fillText(stage.label,x,y,280)
      stage.matches.forEach((match,i)=>{
        const top=y+22+(i+0.5)*(bracketHeight-64)/stage.matches.length-36
        for(const source of [match.home_source,match.away_source]){
          const from=locations.get(source?.matchId)
          if(!from) continue
          ctx.strokeStyle='#879d94'; ctx.lineWidth=2; ctx.beginPath()
          ctx.moveTo(from.x+278,from.y+36);ctx.lineTo(x-20,from.y+36)
          ctx.lineTo(x-20,top+36);ctx.lineTo(x,top+36);ctx.stroke()
        }
        locations.set(match.id,{x,y:top})
        ctx.fillStyle='#e7eee9'; ctx.fillRect(x,top,278,72)
        const winner=prediction.knockoutPicks.find(p=>p.match_id===match.id)?.winner_team_id
        resolveMatchTeams(match,context).forEach((team,index)=>{
          const won=team && team.id===winner
          ctx.fillStyle=won?'#145842':'#394a42'
          ctx.font=won?'bold 20px sans-serif':'19px sans-serif'
          ctx.fillText((won?'✓ ':'')+(team?.name || 'Pendiente'),x+12,top+26+index*32,254)
        })
      })
    })
    const link=document.createElement('a')
    link.download=snapshot.competition.name+' - '+person+'.png'
    link.href=canvas.toDataURL('image/png'); link.click()
  }
  return <button type="button" className="secondary-button" onClick={download}><Download size={16}/> Descargar esquema</button>
}
