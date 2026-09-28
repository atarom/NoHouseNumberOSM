import * as maplibregl from "https://unpkg.com/maplibre-gl@^6.11.2/dist/maplibre-gl.mjs";
const d=document,$=s=>d.querySelector(s);
const updateBtn=$("#update"),overBtn=$("#overpass"),regexIn=$("#regex"),countsEl=$("#counts"),listHead=$(".list-head"),overlay=$("#overlay"),overlayT=$("#overlay-text"),overlayEta=$("#overlay-eta"),overlayLog=$("#overlay-log"),lockZ=$("#lockZoom"),ovX=$("#ovClose");
const BASE="https://postpass.geofabrik.de/api/0.2/",API=BASE+"interpreter",SRC="candidates",LYR="candidates-points",BLUE="#00a8df",ORANGE="#f5a623",OSM="https://www.openstreetmap.org",WAIT=60,ETA=60,EMPTY={type:"FeatureCollection",features:[]};
let ct=null,ci,ai,ei,gb,ac,features=[];
const esc=s=>String(s).replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
const txt=(e,v)=>e&&(e.textContent=v),clr=t=>clearInterval(t),osmType=t=>({N:"node",W:"way",R:"relation"})[t];
const log=msg=>{
if(!overlayLog)return;
const e=d.createElement("div");
e.textContent=`[${new Date().toLocaleTimeString("es-ES",{hour12:false})}] ${msg}`;
overlayLog.appendChild(e);
overlayLog.scrollTop=overlayLog.scrollHeight;
};
const sqlQuery=r=>`WITH area AS (
    SELECT geom
    FROM postpass_polygon
    WHERE osm_type = 'R' AND osm_id = 1311341
)
SELECT
    e.osm_type,
    e.osm_id,
    e.tags,
    CASE
        WHEN e.osm_type = 'N' THEN e.geom
        ELSE ST_Centroid(ST_Envelope(e.geom))
    END AS geom
FROM postpass_pointpolygon e
CROSS JOIN area a
WHERE (
       e.geom && ST_MakeEnvelope(-9.6,35.1,4.5,43.9,4326)
    OR e.geom && ST_MakeEnvelope(-18.3,27.5,-13.2,29.6,4326)
)
AND e.tags ? 'addr:housenumber'
AND e.tags->>'addr:housenumber' ~ '${String(r).replace(/'/g,"''")}'
AND ST_Intersects(
    a.geom,
    CASE
        WHEN e.osm_type = 'N' THEN e.geom
        ELSE ST_PointOnSurface(e.geom)
    END
)`;
const overpassQuery=v=>`[out:xml][maxsize:32Mi][timeout:60];
rel(1311341);
map_to_area;
nwr["addr:housenumber"=${JSON.stringify(String(v))}](area);
(._;>;);
out meta;`;
const map=new maplibregl.Map({container:"map",style:"https://tiles.openfreemap.org/styles/dark",center:[-3.7,40.4],zoom:5,minZoom:2,maxZoom:19});
map.addControl(new maplibregl.NavigationControl(),"top-left");
const popup=new maplibregl.Popup({className:"addr-popup",maxWidth:"420px"}),tip=new maplibregl.Popup({className:"addr-tip",closeButton:false,closeOnClick:false,offset:10});
const eta=s=>{
clr(ei);
txt(overlayEta,`ETA ~${s}s`);
ei=setInterval(()=>txt(overlayEta,--s<0?(clr(ei),"ETA agotada, esperando respuesta…"):`ETA ~${s}s`),1000);
};
const toggleOverlay=open=>{
if(!open){
clr(ai);
clr(ei);
overlay.hidden=true;
return;
}
overlay.hidden=false;
overlayLog.innerHTML="";
log("Preparando consulta Postpass…");
eta(ETA);
const terms=(overlay.dataset.terms||"").split(",").filter(Boolean);
let i=0;
clr(ai);
ai=setInterval(()=>txt(overlayT,terms[i++%terms.length]||"…"),500);
};
ovX.onclick=()=>toggleOverlay(false);
const btn=(title,url,icon)=>`<button type="button" class="pop-btn" title="${title}" aria-label="${title}" onclick="window.open('${url}','_blank')">${icon}</button>`;
const popupHTML=p=>{
let tags={};
try{tags=JSON.parse(p.tags_json||"{}");}catch{}
const hn=tags["addr:housenumber"]||"(sin número)",type=osmType(p.osm_type);
const rows=Object.entries(tags).filter(([k])=>k!=="addr:housenumber").map(([k,v])=>`<div class="pop-row"><span class="pop-key">${esc(k)}</span><span class="pop-val">${esc(v)}</span></div>`).join("")||'<div class="pop-empty">Sin más etiquetas</div>';
const actions=type?btn("Ver en OSM",`${OSM}/${type}/${p.osm_id}`,"🔍")+btn("Editar en iD",`${OSM}/edit?${type}=${p.osm_id}`,"✏️"):"";
return `<div class="pop-wrap"><div class="pop-title">${esc(hn)}</div><div class="pop-tags">${rows}</div><div class="pop-actions">${actions}</div></div>`;
};
const normalize=data=>({
type:"FeatureCollection",
features:data.features.filter(f=>f?.geometry?.type==="Point"&&osmType(f.properties?.osm_type)&&f.properties?.osm_id!=null).map(f=>{
const tags=f.properties.tags||{};
return {type:"Feature",geometry:f.geometry,properties:{osm_type:f.properties.osm_type,osm_id:String(f.properties.osm_id),hn:tags["addr:housenumber"]||"(sin número)",tags_json:JSON.stringify(tags)}};
})
});
const bounds=list=>{
if(!list.length)return null;
const b=new maplibregl.LngLatBounds();
list.forEach(f=>b.extend(f.geometry.coordinates));
return b;
};
const fit=b=>b&&map.fitBounds(b,{padding:30,animate:false});
const sync=()=>{
overBtn.disabled=!ct;
if(map.getLayer(LYR))map.setPaintProperty(LYR,"circle-color",ct?["case",["==",["get","hn"],ct],ORANGE,BLUE]:BLUE);
};
const select=(tag,el)=>{
ct=ct===tag?null:tag;
d.querySelectorAll(".count-item").forEach(e=>e.classList.toggle("selected",e===el&&!!ct));
sync();
if(!lockZ.checked)fit(ct?bounds(features.filter(f=>f.properties.hn===ct)):gb);
};
const renderCounts=()=>{
const totals=features.reduce((a,f)=>(a[f.properties.hn]=(a[f.properties.hn]||0)+1,a),{});
const list=Object.entries(totals).sort((a,b)=>b[1]-a[1]);
txt(listHead,`Resumen por valor · ${features.length} candidatos`);
countsEl.innerHTML=list.length?"":'<div class="count-item">Ningún valor candidato</div>';
list.forEach(([tag,n])=>{
const e=d.createElement("div");
e.className="count-item";
e.innerHTML=`<span class="count-tag">${esc(tag)}</span><span class="count-n">${n}</span>`;
e.onclick=()=>select(tag,e);
countsEl.appendChild(e);
});
};
const load=data=>{
const geo=normalize(data);
if(!geo.features.length)throw new Error("Sin coordenadas válidas en la respuesta de Postpass.");
features=geo.features;
ct=null;
map.getSource(SRC).setData(geo);
sync();
renderCounts();
gb=bounds(features);
fit(gb);
};
const stopCooldown=()=>{
clr(ci);
updateBtn.disabled=false;
updateBtn.classList.remove("cooling");
updateBtn.style.removeProperty("--p");
txt(updateBtn,"Actualizar Datos");
};
const cooldown=()=>{
let s=WAIT;
updateBtn.disabled=true;
updateBtn.classList.add("cooling");
updateBtn.style.setProperty("--p","100%");
txt(updateBtn,`Espera ${s}s`);
ci=setInterval(()=>{
s--;
updateBtn.style.setProperty("--p",`${s/WAIT*100}%`);
s<=0?stopCooldown():txt(updateBtn,`Espera ${s}s`);
},1000);
};
const fetchData=async sql=>{
const body=new URLSearchParams({data:sql});
log(`Servidor Postpass: ${API}`);
const r=await fetch(API,{method:"POST",body,signal:ac.signal});
log(`Postpass: HTTP ${r.status} ${r.statusText||""}`.trim());
if(!r.ok)throw new Error(`Postpass respondió con error HTTP ${r.status}.`);
const data=await r.json();
if(data?.type!=="FeatureCollection"||!Array.isArray(data.features))throw new Error("Respuesta GeoJSON no válida.");
log(`Postpass: features recibidas ${data.features.length}`);
return data;
};
const update=async()=>{
ac?.abort();
ac=new AbortController();
toggleOverlay(true);
log("Enviando consulta SQL a Postpass…");
let ok=false;
try{
load(await fetchData(sqlQuery(regexIn.value)));
log("Actualización completada.");
txt(overlayT,"OK");
ok=true;
}catch(e){
txt(overlayT,e.name==="AbortError"?"CANCELADO":"ERROR");
log(e.name==="AbortError"?"Consulta anterior cancelada.":`Error: ${e.message||e}`);
if(e.name!=="AbortError")log("El overlay queda abierto para revisar el log o cerrar con ✕.");
}finally{
log("Proceso finalizado.");
if(ok)setTimeout(()=>{
toggleOverlay(false);
cooldown();
},1400);
}
};
const feature=e=>e.features?.[0];
map.on("load",()=>{
map.addSource(SRC,{type:"geojson",data:EMPTY});
map.addLayer({id:LYR,type:"circle",source:SRC,paint:{"circle-radius":7,"circle-color":BLUE,"circle-opacity":.92,"circle-stroke-width":1.5,"circle-stroke-color":"#fff"}});
map.on("mouseenter",LYR,e=>{
map.getCanvas().style.cursor="pointer";
const f=feature(e);
if(f)tip.setLngLat(f.geometry.coordinates).setText(f.properties.hn||"").addTo(map);
});
map.on("mouseleave",LYR,()=>{
map.getCanvas().style.cursor="";
tip.remove();
});
map.on("click",LYR,e=>{
const f=feature(e);
if(f)popup.setLngLat(f.geometry.coordinates).setHTML(popupHTML(f.properties)).addTo(map);
});
update();
});
updateBtn.onclick=update;
overBtn.onclick=()=>{
if(ct)window.open(`https://overpass-turbo.eu/?Q=${encodeURIComponent(overpassQuery(ct))}`,"_blank");
};
regexIn.oninput=stopCooldown;
sync();
