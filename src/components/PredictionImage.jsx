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
    const final=snapshot.matches.find(m=>m.stage==='final')
    const third=snapshot.matches.find(m=>m.stage==='third_place')
    const byId=new Map(snapshot.matches.map(m=>[m.id,m]))
    const winner=match=>snapshot.teams.find(t=>t.id===prediction.knockoutPicks.find(p=>p.match_id===match?.id)?.winner_team_id)?.name || 'Pendiente'
    function branch(source,team,seen) {
      const match=source?.type==='match_winner' && byId.get(source.matchId)
      if(!match || seen.has(match.id)) return {text:team?.name || 'Pendiente',color:'#086298',leaves:1,depth:1}
      const visited=new Set(seen).add(match.id)
      const sides=resolveMatchTeams(match,context)
      const children=[match.home_source,match.away_source].map((s,i)=>branch(s,sides[i],visited))
      const colors={round32:'#427729',round16:'#007155',quarterfinal:'#97457e',semifinal:'#a06400'}
      return {text:winner(match),color:colors[match.stage] || '#145842',children,leaves:children[0].leaves+children[1].leaves,depth:1+Math.max(...children.map(c=>c.depth))}
    }
    const finalists=final ? resolveMatchTeams(final,context) : []
    const roots=final ? [final.home_source,final.away_source].map((s,i)=>branch(s,finalists[i],new Set([final.id]))) : []
    const depth=Math.max(1,...roots.map(r=>r.depth))
    const bracketHeight=final ? Math.max(250,Math.max(...roots.map(r=>r.leaves))*48+70) : 0
    if(!final) rounds.forEach(r=>sections.push({title:r.label,lines:r.matches.map(m=>(m.label || r.label)+' · '+winner(m))}))
    sections.push({title:'Bota de Oro',lines:[snapshot.candidates.find(c=>c.id===prediction.awardPick?.candidate_id)?.name || prediction.awardPick?.custom_name || 'Pendiente']})
    const canvas=document.createElement('canvas')
    canvas.width=Math.max(1100,(2*depth+1)*220+64)
    canvas.height=148+bracketHeight+sections.reduce((h,s)=>h+68+32*s.lines.length,0)
    const ctx=canvas.getContext('2d')
    ctx.fillStyle='#fafbf8'; ctx.fillRect(0,0,canvas.width,canvas.height)
    ctx.fillStyle='#145842'; ctx.fillRect(0,0,canvas.width,104)
    ctx.fillStyle='white'; ctx.font='bold 34px Georgia'; ctx.fillText(snapshot.competition.name,32,48,1036)
    ctx.font='22px sans-serif'; ctx.fillText('Porra de '+person,32,83,1036)
    let y=140+bracketHeight
    for(const section of sections) {
      ctx.fillStyle='#145842'; ctx.font='bold 25px sans-serif'; ctx.fillText(section.title,32,y,1036)
      y+=36; ctx.fillStyle='#172621'; ctx.font='22px sans-serif'
      for(const line of section.lines){ctx.fillText(line,48,y,1000);y+=32}
      y+=32
    }
    if(final) {
      const midX=canvas.width/2, midY=138+bracketHeight/2
      function box(x,y,label,color) {
        ctx.fillStyle=color; ctx.fillRect(x-89,y-16,178,32)
        ctx.strokeStyle='#18251e'; ctx.lineWidth=2; ctx.strokeRect(x-89,y-16,178,32)
        ctx.fillStyle='white'; ctx.textAlign='center'; ctx.font='bold 17px sans-serif'
        ctx.fillText(label,x,y+6,165)
      }
      function arm(node,x,top,side) {
        const y=top+node.leaves*24
        if(node.children) {
          let next=top
          for(const child of node.children) {
            const childX=x+side*220
            const childY=arm(child,childX,next,side)
            ctx.strokeStyle='#263c32';ctx.beginPath();ctx.moveTo(childX-side*89,childY)
            ctx.lineTo(x+side*110,childY);ctx.lineTo(x+side*110,y);ctx.lineTo(x+side*89,y);ctx.stroke()
            next+=child.leaves*48
          }
        }
        box(x,y,node.text,node.color)
        return y
      }
      roots.forEach((root,i)=>{
        const side=i===0?-1:1
        arm(root,midX+side*220,midY-root.leaves*24,side)
        ctx.beginPath();ctx.moveTo(midX+side*131,midY);ctx.lineTo(midX+side*89,midY);ctx.stroke()
      })
      function placing(label,match,y,color) {
        box(midX,y,winner(match),color);ctx.fillStyle='#28372e';ctx.font='bold 14px sans-serif';ctx.fillText(label,midX,y-23)
      }
      placing('CAMPEÓN',final,midY,'#a92c36')
      if(third) placing('TERCER PUESTO',third,midY+68,'#896900')
      ctx.textAlign='left'
    }
    const link=document.createElement('a')
    link.download=snapshot.competition.name+' - '+person+'.png'
    link.href=canvas.toDataURL('image/png'); link.click()
  }
  return <button type="button" className="secondary-button" onClick={download}><Download size={16}/> Descargar esquema</button>
}
