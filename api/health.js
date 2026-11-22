export default async function health(request,response) {
  response.setHeader('Cache-Control','no-store')
  if(request.method!=='GET') return response.status(405).end()
  const url=process.env.VITE_SUPABASE_URL || 'https://qwthwujldycxazwmouux.supabase.co'
  const apikey=process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_iRawcGAAty2cUa8tURavuA_a1Nb8M9v'
  try {
    const check=await fetch(url+'/rest/v1/competitions?select=id&is_active=eq.true&limit=1',{
      headers:{apikey},signal:AbortSignal.timeout(8000)
    })
    if(check.ok && (await check.json()).length===1) return response.status(200).json({status:'ok'})
  } catch { /* Return the same service status for timeouts and failed reads. */ }
  return response.status(503).json({status:'unavailable'})
}
