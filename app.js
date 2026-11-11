"use strict";

const $ = id => document.getElementById(id);
const icons = {
  network:'<path d="m5 6 7 6 7-6m-7 6v7"/><circle cx="5" cy="5" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>',
  upload:'<path d="M12 15V3m-4 4 4-4 4 4M4 14v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"/>',
  download:'<path d="M12 3v12m-4-4 4 4 4-4M4 14v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',minus:'<path d="M5 12h14"/>',
  layers:'<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5m-18 4 9 5 9-5"/>',
  search:'<circle cx="10" cy="10" r="5.5"/><path d="m14 14 5 5"/>',
  file:'<path d="M6 3h8l4 4v14H6zM14 3v5h4m-9 6h6m-3-3v6"/>',
  link:'<path d="m10 13 4-4m-6 7-1 1a3 3 0 0 1-4-4l4-4a3 3 0 0 1 4 0m2 5a3 3 0 0 0 4 0l4-4a3 3 0 0 0-4-4l-1 1"/>',
  fit:'<path d="M9 4H4v5m11-5h5v5m0 6v5h-5m-6 0H4v-5"/><circle cx="12" cy="12" r="2"/>',
  settings:'<path d="M5 5v14M12 5v14M19 5v14"/><circle fill="white" cx="5" cy="9" r="2"/><circle fill="white" cx="12" cy="15" r="2"/><circle fill="white" cx="19" cy="10" r="2"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 3v4"/>',
  trash:'<path d="M4 7h16m-10-3h4m-8 3 1 13h10l1-13m-8 4v5m4-5v5"/>',
  undo:'<path d="m9 6-5 5 5 5m-5-5h10a5 5 0 0 1 5 5v2"/>',
  redo:'<path d="m15 6 5 5-5 5m5-5H10a5 5 0 0 0-5 5v2"/>',
  edit:'<path d="m13 6 5 5M5 19l4-.7L20 7a2 2 0 0 0-3-3L6 15z"/>',
  chevron:'<path d="m9 6 6 6-6 6"/>'
};
const icon = name => '<svg class="icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">'+icons[name]+'</svg>';
document.querySelectorAll("[data-icon]").forEach(el => el.insertAdjacentHTML("afterbegin",icon(el.dataset.icon)));

const colors = ["#8b69df","#e78cac","#65b7a4","#edb661","#7c9ee5","#a6a1b8"];
const shapes = ["Circle","Rounded square","Diamond","Hexagon"];
const key = "constellation.network.v1";
const demo = {
  title:"Inner constellation",
  nodes:[
    ["anchor","The Anchor","Grounding","#8b69df","Circle",37,320,250,"A reminder of what feels steady and familiar."],
    ["guardian","The Guardian","Boundaries","#e78cac","Rounded square",28,155,110,""],
    ["observer","The Observer","Reflection","#7c9ee5","Diamond",28,481,113,""],
    ["spark","The Spark","Creativity","#edb661","Circle",25,505,302,""],
    ["keeper","The Keeper","Memory","#65b7a4","Hexagon",28,251,404,""],
    ["wanderer","The Wanderer","Curiosity","#a6a1b8","Circle",22,113,294,""]
  ].map(([id,name,label,color,shape,size,x,y,notes])=>({id,name,label,color,shape,size,x,y,notes})),
  edges:[
    ["anchor","guardian"],["anchor","observer"],["anchor","spark"],["anchor","keeper"],
    ["anchor","wanderer"],["guardian","wanderer"],["observer","spark"]
  ].map(([source,target],i)=>({id:"edge-"+i,source,target,label:""}))
};
const blank = () => ({title:"Untitled graph",nodes:[],edges:[]});
let storageAvailable = true;
let model = demo;
try {
  const saved = localStorage.getItem(key);
  if (saved) model = parseGraph(JSON.parse(saved));
} catch { storageAvailable = false; }
let selected = model.nodes[0]?.id;
let tab = "nodes";
let connecting = false;
let source = null;
const undoStack = [];
const redoStack = [];
let editGroup;

function updateHistory(){
  $("undo").disabled = !undoStack.length;
  $("redo").disabled = !redoStack.length;
}

function remember(group,refit=false){
  if(group && editGroup===group) return;
  undoStack.push({graph:structuredClone(model),selected,tab,refit});
  if(undoStack.length>50) undoStack.shift();
  redoStack.length=0;
  editGroup=group;
  updateHistory();
}

function restore(from,to){
  if(!from.length) return;
  const snapshot=from.pop();
  to.push({graph:structuredClone(model),selected,tab,refit:snapshot.refit});
  model=snapshot.graph;
  selected=snapshot.selected;
  tab=snapshot.tab;
  editGroup=null;
  $("title").value=model.title;
  $("search").value="";
  toggleConnect(false);
  if(snapshot.refit) fit();
  updateHistory();
  save();
}

function trackField(input,apply){
  input.addEventListener("input",()=>{
    remember(input);
    apply(input.value);
  });
  input.addEventListener("blur",()=>{if(editGroup===input)editGroup=null;});
  if(input.type==="range" || input.type==="color"){
    input.addEventListener("change",()=>{if(editGroup===input)editGroup=null;});
  }
}

function parseGraph(data) {
  const string = (value,max) => typeof value==="string" && value.length<=max;
  const coordinate = value => Number.isFinite(value) && Math.abs(value)<=1000000;
  const require = valid => { if(!valid) throw new Error("Invalid graph data"); };
  require(data && string(data.title,80) && Array.isArray(data.nodes) && Array.isArray(data.edges));
  require(data.nodes.length<=2000 && data.edges.length<=10000);
  const ids = new Set();
  const nodes = data.nodes.map(n => {
    require(n && string(n.id,100) && n.id && !ids.has(n.id) && string(n.name,80) && string(n.label,60) && string(n.notes,5000));
    require(typeof n.color==="string" && /^#[0-9a-f]{6}$/i.test(n.color) && shapes.includes(n.shape) && Number.isFinite(n.size) && n.size>=12 && n.size<=52 && coordinate(n.x) && coordinate(n.y));
    ids.add(n.id);
    return {id:n.id,name:n.name,label:n.label,notes:n.notes,color:n.color,shape:n.shape,size:n.size,x:n.x,y:n.y};
  });
  const edgeIds = new Set(ids);
  const pairs = new Set();
  const edges = data.edges.map(e => {
    require(e && string(e.id,100) && e.id && !edgeIds.has(e.id) && ids.has(e.source) && ids.has(e.target) && e.source!==e.target && string(e.label,60));
    const pair = JSON.stringify([e.source,e.target].sort());
    require(!pairs.has(pair));
    pairs.add(pair);
    edgeIds.add(e.id);
    return {id:e.id,source:e.source,target:e.target,label:e.label};
  });
  return {title:data.title,nodes,edges};
}

function save() {
  try { localStorage.setItem(key,JSON.stringify(model)); storageAvailable = true; }
  catch { storageAvailable = false; }
  $("save-state").innerHTML = storageAvailable ? "<i></i> Saved on this device" : "Autosave unavailable";
}

const svg = d3.select("#graph");
const viewport = svg.append("g");
const edgeLayer = viewport.append("g");
const draft = viewport.append("line").attr("class","draft-edge").attr("display","none");
const nodeLayer = viewport.append("g");
const zoom = d3.zoom().scaleExtent([.08,5]).on("zoom",event=>{
  viewport.attr("transform",event.transform);
  $("zoom-level").value = Math.round(event.transform.k*100)+"%";
  updateDraft();
});
svg.call(zoom).on("dblclick.zoom",null);
svg.on("click",()=>{
  if (connecting) toggleConnect(false);
  else { selected = null; refresh(); }
});
svg.on("contextmenu",event=>openMenu(event));
let pointer;
function trackPointer(event){
  pointer=d3.pointer(event,svg.node());
  updateDraft();
}
svg.on("pointermove",trackPointer);

function updateDraft(){
  const node=source && model.nodes.find(n=>n.id===source);
  draft.attr("display",node && pointer?null:"none");
  if(!node || !pointer) return;
  const [x,y]=d3.zoomTransform(svg.node()).invert(pointer);
  draft.attr("x1",node.x).attr("y1",node.y).attr("x2",x).attr("y2",y);
}

const drag = d3.drag()
  .container(()=>viewport.node())
  .filter(event=>!connecting && !event.button && !event.ctrlKey && !event.target.closest(".port"))
  .on("start",event=>{
    let moved=false;
    event.on("drag", (motion,n)=>{
      if(!moved){remember();moved=true;}
      n.x = Math.max(-1000000,Math.min(1000000,motion.x));
      n.y = Math.max(-1000000,Math.min(1000000,motion.y));
      positionGraph();
    });
  })
  .on("end",save);

function nodeName(n){ return n?.name.trim() || "Untitled node"; }

function outline(shape,r) {
  switch (shape) {
    case "Rounded square": {
      const s=r*.89, q=r*.26;
      return `M${-s+q},${-s}H${s-q}Q${s},${-s} ${s},${-s+q}V${s-q}Q${s},${s} ${s-q},${s}H${-s+q}Q${-s},${s} ${-s},${s-q}V${-s+q}Q${-s},${-s} ${-s+q},${-s}Z`;
    }
    case "Diamond": return `M0,${-r}L${r},0 0,${r} ${-r},0Z`;
    case "Hexagon": return "M"+d3.range(6).map(i=>[r*Math.cos(Math.PI*i/3),r*Math.sin(Math.PI*i/3)].join(",")).join("L")+"Z";
    default: return `M${-r},0a${r},${r} 0 1,0 ${2*r},0a${r},${r} 0 1,0 ${-2*r},0Z`;
  }
}
function shapeIcon(shape,color="currentColor"){
  return '<svg class="icon" viewBox="-12 -12 24 24" aria-hidden="true"><path d="'+outline(shape,8)+'" fill="'+color+'" opacity=".22"/><path d="'+outline(shape,8)+'" fill="none" stroke="'+color+'" stroke-width="1.6"/></svg>';
}

function positionGraph(){
  nodeLayer.selectAll(".vertex").attr("transform",n=>`translate(${n.x},${n.y})`);
  edgeLayer.selectAll("g").each(function(edge){
    const a=nodesById.get(edge.source), b=nodesById.get(edge.target);
    const group=d3.select(this);
    group.selectAll("line").attr("x1",a.x).attr("y1",a.y).attr("x2",b.x).attr("y2",b.y);
    group.select("text").attr("x",(a.x+b.x)/2).attr("y",(a.y+b.y)/2-6);
  });
}
let nodesById;

function renderGraph(){
  nodesById = new Map(model.nodes.map(n=>[n.id,n]));
  const links=edgeLayer.selectAll("g").data(model.edges,e=>e.id).join(enter=>{
    const g=enter.append("g");
    g.append("line").attr("class","edge-line").attr("pointer-events","none");
    g.append("line").attr("class","edge-hit").attr("stroke","transparent").attr("stroke-width",15)
      .on("click",(event,e)=>{event.stopPropagation(); if(!connecting) pickEdge(e.id);})
      .on("contextmenu",(event,e)=>openMenu(event,null,e));
    g.append("text").attr("class","edge-label").attr("text-anchor","middle").attr("font-size",10).attr("fill","#594775");
    return g;
  });
  links.select(".edge-line").attr("stroke",e=>e.id===selected?"#7954d2":"#bdb0d3")
    .attr("stroke-width",e=>e.id===selected?2.6:1.6);
  links.select("text").text(e=>short(e.label,26));
  const vertices=nodeLayer.selectAll(".vertex").data(model.nodes,n=>n.id).join(enter=>{
    const g=enter.append("g").attr("class","vertex").attr("tabindex",0).attr("role","button")
      .on("click",(event,n)=>{event.stopPropagation(); pickNode(n.id);})
      .on("keydown",(event,n)=>{
        if(event.target.closest(".port")) return;
        if(event.key==="Enter" || event.key===" "){event.preventDefault();pickNode(n.id);}
      })
      .on("contextmenu",(event,n)=>openMenu(event,n))
      .call(drag);
    g.append("path").attr("class","halo");
    g.append("path").attr("class","node-shape");
    g.append("circle").attr("class","dot");
    g.append("text").attr("class","name").attr("text-anchor","middle");
    g.append("text").attr("class","tag").attr("text-anchor","middle");
    const port=g.append("g").attr("class","port").attr("role","button").attr("tabindex",0)
      .on("mousedown touchstart",event=>event.stopPropagation())
      .on("click",(event,n)=>{event.stopPropagation();startConnection(n.id,event);})
      .on("keydown",(event,n)=>{
        if(event.key==="Enter" || event.key===" "){
          event.preventDefault();
          event.stopPropagation();
          startConnection(n.id);
        }
      });
    port.append("circle").attr("class","port-hit").attr("r",15);
    port.append("circle").attr("class","port-face").attr("r",10);
    port.append("path").attr("d","M-4 0h8M0-4v8");
    return g;
  });
  vertices.attr("aria-label",nodeName).attr("aria-pressed",n=>n.id===selected);
  vertices.select(".halo").attr("d",n=>outline(n.shape,n.size+8))
    .attr("fill",n=>n.color).attr("fill-opacity",n=>n.id===selected||n.id===source ? .13 : 0)
    .attr("stroke",n=>n.id===source?n.color:"none").attr("stroke-dasharray","3 3");
  vertices.select(".node-shape").attr("d",n=>outline(n.shape,n.size)).attr("fill",n=>n.color)
    .attr("fill-opacity",.34).attr("stroke",n=>n.color).attr("stroke-width",n=>n.id===selected?2.4:1.7);
  vertices.select(".dot").attr("r",n=>n.id===selected?6:4).attr("fill",n=>n.color);
  vertices.select(".name").attr("y",n=>n.size+20).text(n=>short(nodeName(n),28));
  vertices.select(".tag").attr("y",n=>n.size+35).text(n=>short(n.label,28));
  vertices.select(".port").attr("transform",n=>`translate(${n.size*.8},${-n.size*.8})`)
    .attr("aria-label",n=>"Connect from "+nodeName(n))
    .attr("tabindex",connecting?-1:0);
  positionGraph();
  $("empty").hidden = !!model.nodes.length;
}

function short(value,max){ return value.length>max?value.slice(0,max-1)+"…":value; }

function fit(){
  const {width,height}=$("stage").getBoundingClientRect();
  if (!model.nodes.length) { svg.call(zoom.transform,d3.zoomIdentity); return; }
  const minX=d3.min(model.nodes,n=>n.x-Math.max(n.size+10,short(nodeName(n),28).length*3.8,short(n.label,28).length*3));
  const maxX=d3.max(model.nodes,n=>n.x+Math.max(n.size+10,short(nodeName(n),28).length*3.8,short(n.label,28).length*3));
  const minY=d3.min(model.nodes,n=>n.y-n.size-10);
  const maxY=d3.max(model.nodes,n=>n.y+n.size+39);
  const k=Math.max(.08,Math.min(1.3,(width-56)/Math.max(1,maxX-minX),(height-100)/Math.max(1,maxY-minY)));
  svg.call(zoom.transform,d3.zoomIdentity.translate(width/2-k*(minX+maxX)/2,(height-22)/2-k*(minY+maxY)/2).scale(k));
}

function displayHint(message){
  $("hint").textContent = message;
  $("hint").hidden = !message;
}
function toggleConnect(on){
  connecting=on;
  source=null;
  $("connect").setAttribute("aria-pressed",on);
  $("stage").classList.toggle("connecting",on);
  displayHint(on?"Select the first node to connect.":"");
  updateDraft();
  refresh();
}
function startConnection(id,event){
  if(model.nodes.length<2){displayHint("Add another node to make a connection.");return;}
  if(event) pointer=d3.pointer(event,svg.node());
  else pointer=null;
  toggleConnect(true);
  pickNode(id);
  if(!event) nodeLayer.selectAll(".vertex").filter(n=>n.id===id).node()?.focus();
}
function pickNode(id){
  if(connecting){
    if(!source){
      source=id;
      displayHint("Select a node to connect. Esc cancels.");
      updateDraft();
    }
    else if(source!==id){
      const existing=model.edges.find(e=>(e.source===source&&e.target===id)||(e.source===id&&e.target===source));
      if (!existing && model.edges.length>=10000) {displayHint("This graph has reached its connection limit.");return;}
      const edge=existing || {id:crypto.randomUUID(),source,target:id,label:""};
      if(!existing){remember();model.edges.push(edge);save();}
      toggleConnect(false);
      pickEdge(edge.id);
      return;
    }
  }
  selected=id;
  tab="nodes";
  refresh();
}
function pickEdge(id){
  selected=id;
  tab="edges";
  refresh();
}
function createNode(at){
  if(model.nodes.length>=2000){alert("This graph has reached its node limit.");return;}
  remember();
  toggleConnect(false);
  const stage=$("stage");
  const [x,y]=at ?? d3.zoomTransform(svg.node()).invert([stage.clientWidth/2,stage.clientHeight/2]);
  let offset=0;
  while(!at && model.nodes.some(n=>Math.hypot(n.x-x-offset,n.y-y-offset)<42)) offset+=52;
  const node={id:crypto.randomUUID(),name:"New node",label:"",notes:"",color:colors[model.nodes.length%colors.length],shape:"Circle",size:28,
    x:Math.max(-1000000,Math.min(1000000,x+offset)),y:Math.max(-1000000,Math.min(1000000,y+offset))};
  model.nodes.push(node);
  $("search").value="";
  pickNode(node.id);
  if(!at && (offset || model.nodes.length===1)) fit();
  save();
  $("node-name").focus();
  $("node-name").select();
}

function renderList(){
  $("node-count").textContent=model.nodes.length;
  $("edge-count").textContent=model.edges.length;
  $("summary").textContent=model.nodes.length+" "+(model.nodes.length===1?"node":"nodes")+" · "+model.edges.length+" "+(model.edges.length===1?"connection":"connections");
  $("nodes-tab").setAttribute("aria-pressed",tab==="nodes");
  $("edges-tab").setAttribute("aria-pressed",tab==="edges");
  $("search").placeholder="Search "+tab+"…";
  const term=$("search").value.trim().toLowerCase();
  $("elements").replaceChildren();
  const list=tab==="nodes"?model.nodes:model.edges;
  for(const item of list){
    const isNode=tab==="nodes";
    const name=isNode?nodeName(item):nodeName(nodesById.get(item.source))+" ↔ "+nodeName(nodesById.get(item.target));
    const description=item.label || (isNode?item.shape:"Connection");
    if(![name,description].some(value=>value.toLowerCase().includes(term))) continue;
    const row=document.createElement("button");
    row.className="row";
    row.setAttribute("aria-current",item.id===selected);
    row.innerHTML='<span class="chip">'+(isNode?shapeIcon(item.shape,item.color):icon("link"))+'</span><span class="row-text"><strong></strong><small></small></span>'+icon("chevron");
    row.querySelector("strong").textContent=name;
    row.querySelector("small").textContent=description;
    row.addEventListener("click",()=>isNode?pickNode(item.id):pickEdge(item.id));
    row.addEventListener("contextmenu",event=>isNode?openMenu(event,item):openMenu(event,null,item));
    $("elements").append(row);
  }
  if(!$("elements").children.length){
    const p=document.createElement("p");
    p.className="muted";
    p.textContent=term?"No matching "+tab+".":"No "+tab+" yet.";
    $("elements").append(p);
  }
}

function renderInspector(){
  const panel=$("properties");
  const node=model.nodes.find(n=>n.id===selected);
  const edge=model.edges.find(e=>e.id===selected);
  if(!node&&!edge){
    panel.innerHTML='<p class="muted">Select a node or connection to edit it.</p>';
    return;
  }
  panel.replaceChildren();
  const update=()=>{renderGraph();renderList();save();};
  const field=(label,id,tag,max,object,property,placeholder)=>{
    const wrapper=document.createElement("label");
    wrapper.className="field";
    wrapper.innerHTML="<span>"+label+"</span>";
    const input=document.createElement(tag);
    input.id=id;input.maxLength=max;input.value=object[property];input.placeholder=placeholder;
    trackField(input,value=>{object[property]=value;update();});
    wrapper.append(input);panel.append(wrapper);
    return input;
  };
  if(node){
    const name=field("Name","node-name","input",80,node,"name","Untitled node");
    name.addEventListener("keydown",event=>{
      if(event.key==="Enter" && !event.isComposing) name.blur();
    });
    field("Canvas label","node-label","input",60,node,"label","Add a short label");
    field("Notes","node-notes","textarea",5000,node,"notes","Write a note…");
    panel.insertAdjacentHTML("beforeend",'<div class="section-title">Appearance</div><div class="field"><span>Shape</span><div class="shapes" role="group" aria-label="Node shape"></div></div><div class="field"><span>Colour</span><div class="colors" role="group" aria-label="Node colour"></div></div><label class="field"><span>Size <output id="size-value"></output></span><input type="range" id="node-size" min="12" max="52"></label>');
    const shapeButtons=[];
    const colorButtons=[];
    for(const shape of shapes){
      const button=document.createElement("button");
      button.title=shape;
      button.setAttribute("aria-label",shape);
      button.innerHTML=shapeIcon(shape);
      shapeButtons.push([shape,button]);
      button.onclick=()=>{if(node.shape!==shape){remember();node.shape=shape;updateAppearance();update();}};
      panel.querySelector(".shapes").append(button);
    }
    const colorInput=document.createElement("input");
    colorInput.type="color";
    colorInput.setAttribute("aria-label","Custom colour");
    trackField(colorInput,value=>{node.color=value;updateAppearance();update();});
    const colorNames=["Lavender","Rose","Mint","Amber","Blue","Slate"];
    colors.forEach((color,i)=>{
      const button=document.createElement("button");
      button.title=colorNames[i];
      button.setAttribute("aria-label",colorNames[i]);
      const swatch=document.createElement("i");
      swatch.style.backgroundColor=color;
      button.append(swatch);
      colorButtons.push([color,button]);
      button.onclick=()=>{if(node.color!==color){remember();node.color=color;updateAppearance();update();}};
      panel.querySelector(".colors").append(button);
    });
    panel.querySelector(".colors").append(colorInput);
    $("node-size").value=node.size;
    trackField($("node-size"),value=>{node.size=Number(value);updateAppearance();update();});
    function updateAppearance(){
      shapeButtons.forEach(([shape,button])=>button.setAttribute("aria-pressed",shape===node.shape));
      colorButtons.forEach(([color,button])=>button.setAttribute("aria-pressed",color===node.color));
      colorInput.value=node.color;
      $("size-value").value=node.size;
    }
    updateAppearance();
  } else field("Connection label","edge-label","input",60,edge,"label","Describe the connection");
  const remove=document.createElement("button");
  remove.className="delete";
  remove.setAttribute("aria-keyshortcuts","Delete Backspace");
  remove.innerHTML=icon("trash")+(node?"Delete node":"Delete connection");
  remove.onclick=()=>removeElement(node,edge);
  panel.append(remove);
}

function removeElement(node,edge){
  remember();
  if(node) model.nodes=model.nodes.filter(n=>n.id!==node.id);
  model.edges=model.edges.filter(e=>node?e.source!==node.id&&e.target!==node.id:e.id!==edge.id);
  if(selected===(node??edge).id) selected=null;
  toggleConnect(false);
  save();
}

const menu=$("context-menu");
let menuOrigin;

function closeMenu(restoreFocus=false){
  if(menu.hidden) return;
  menu.hidden=true;
  if(restoreFocus) menuOrigin?.focus();
  menuOrigin=null;
}

function openMenu(event,node,edge){
  event.preventDefault();
  event.stopPropagation();
  if(connecting) toggleConnect(false);
  const origin=event.target.closest("button,.vertex") ?? svg.node();
  const rect=origin.getBoundingClientRect();
  const x=event.clientX || rect.left+16;
  const y=event.clientY || rect.top+16;
  const point=d3.zoomTransform(svg.node()).invert(d3.pointer({clientX:x,clientY:y},svg.node()));
  menuOrigin=origin;
  menu.replaceChildren();
  function action(label,image,run,disabled=false,danger=false){
    const button=document.createElement("button");
    button.type="button";
    button.setAttribute("role","menuitem");
    button.tabIndex=-1;
    button.disabled=disabled;
    button.classList.toggle("danger",danger);
    button.innerHTML=icon(image);
    button.append(label);
    button.onclick=()=>{closeMenu(true);run();};
    menu.append(button);
  }
  function edit(id,isNode){
    if(isNode)pickNode(id);
    else pickEdge(id);
    const field=$(isNode?"node-name":"edge-label");
    field.focus();
    field.select();
  }
  if(node){
    action("Rename node","edit",()=>edit(node.id,true));
    action("Connect from here","link",()=>startConnection(node.id,{clientX:x,clientY:y}),model.nodes.length<2);
    action("Delete node","trash",()=>removeElement(node,null),false,true);
  } else if(edge){
    action("Edit connection label","edit",()=>edit(edge.id,false));
    action("Delete connection","trash",()=>removeElement(null,edge),false,true);
  } else {
    action("Add node here","plus",()=>createNode(point));
    action("Fit graph","fit",fit,!model.nodes.length);
    action("Undo","undo",()=>restore(undoStack,redoStack),!undoStack.length);
    action("Redo","redo",()=>restore(redoStack,undoStack),!redoStack.length);
  }
  menu.hidden=false;
  menu.style.left=Math.max(6,Math.min(x,innerWidth-menu.offsetWidth-6))+"px";
  menu.style.top=Math.max(6,Math.min(y,innerHeight-menu.offsetHeight-6))+"px";
  menu.querySelector("button:enabled").focus();
}

menu.addEventListener("keydown",event=>{
  if(event.key==="Tab"){closeMenu(true);return;}
  if(!["ArrowDown","ArrowUp","Home","End"].includes(event.key))return;
  event.preventDefault();
  const items=[...menu.querySelectorAll("button:enabled")];
  const index=items.indexOf(document.activeElement);
  if(event.key==="Home")items[0].focus();
  else if(event.key==="End")items.at(-1).focus();
  else items[(index+(event.key==="ArrowDown"?1:-1)+items.length)%items.length].focus();
});
document.addEventListener("pointerdown",event=>{if(!menu.contains(event.target))closeMenu();});
window.addEventListener("resize",()=>closeMenu());

function refresh(){renderGraph();renderList();renderInspector();}
function replaceGraph(graph){
  remember(undefined,true);
  model=graph;
  selected=graph.nodes[0]?.id;
  tab="nodes";
  $("search").value="";
  $("title").value=graph.title;
  toggleConnect(false);
  fit();
  save();
}

$("title").value=model.title;
$("title").addEventListener("keydown",event=>{if(event.key==="Enter")event.target.blur();});
trackField($("title"),value=>{model.title=value;save();});
$("title").onblur=()=>{if(!model.title.trim()){$("title").value=model.title="Untitled graph";save();}};
$("add").onclick=()=>createNode();
$("empty-add").onclick=()=>createNode();
$("undo").onclick=()=>restore(undoStack,redoStack);
$("redo").onclick=()=>restore(redoStack,undoStack);
$("connect").onclick=()=>toggleConnect(!connecting);
$("nodes-tab").onclick=()=>{tab="nodes";$("search").value="";renderList();};
$("edges-tab").onclick=()=>{tab="edges";$("search").value="";renderList();};
$("search").oninput=renderList;
$("plus").onclick=()=>svg.call(zoom.scaleBy,1.24);
$("minus").onclick=()=>svg.call(zoom.scaleBy,1/1.24);
$("fit").onclick=fit;
$("blank").onclick=()=>{if((!model.nodes.length && model.title==="Untitled graph")||confirm("Replace this graph with a blank graph? Export first to keep a copy.")) replaceGraph(blank());};
$("export").onclick=()=>{
  const file=new Blob([JSON.stringify({version:1,...model},null,2)],{type:"application/json"});
  const url=URL.createObjectURL(file);
  const a=document.createElement("a");
  a.href=url;
  a.download=(model.title.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"network")+".json";
  document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
};
$("import").onclick=()=>$("file").click();
$("file").onchange=async event=>{
  const file=event.target.files[0];
  event.target.value="";
  if(!file)return;
  let graph;
  try{
    if(file.size>80_000_000)throw new Error("File too large");
    const data=JSON.parse(await file.text());
    if(data?.version!==1)throw new Error("Unknown version");
    graph=parseGraph(data);
  }catch{alert("Could not import this graph. Choose a valid Constellation JSON export.");return;}
  if(confirm("Replace the current graph with the imported graph? Export first to keep a copy."))replaceGraph(graph);
};
document.addEventListener("keydown",event=>{
  if(event.key==="Escape"){
    if(!menu.hidden)closeMenu(true);
    else if(connecting)toggleConnect(false);
    else displayHint("");
    return;
  }
  if(event.defaultPrevented || event.isComposing || event.target.closest?.("input,textarea,select,[contenteditable]"))return;
  if(!event.ctrlKey && !event.metaKey && !event.altKey && menu.hidden){
    if((event.key==="Delete" || event.key==="Backspace") && !event.shiftKey){
      if(!selected || event.repeat)return;
      const node=nodesById.get(selected);
      const edge=model.edges.find(e=>e.id===selected);
      if(node || edge){
        event.preventDefault();
        removeElement(node,edge);
      }
      return;
    }
    const name=$("node-name");
    if(name && !connecting && [...event.key].length===1 && event.key.trim()){
      event.preventDefault();
      name.focus();
      name.setSelectionRange(name.value.length,name.value.length);
    }
    return;
  }
  if(!(event.ctrlKey||event.metaKey) || event.altKey)return;
  const key=event.key.toLowerCase();
  if(key==="z" || key==="y"){
    event.preventDefault();
    const redo=key==="y" || event.shiftKey;
    restore(redo?redoStack:undoStack,redo?undoStack:redoStack);
  }
});
refresh();
save();
fit();
let previousWidth=$("stage").clientWidth;
let previousHeight=$("stage").clientHeight;
new ResizeObserver(()=>{
  const stage=$("stage");
  if(stage.clientWidth!==previousWidth || stage.clientHeight!==previousHeight){
    previousWidth=stage.clientWidth;
    previousHeight=stage.clientHeight;
    fit();
  }
}).observe($("stage"));
