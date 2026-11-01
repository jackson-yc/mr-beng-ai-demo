// Capture-only deterministic animation. Never imported by the interactive demo.
import * as T from './vendor/three.module.min.js';
import {buildShowroom} from './scene.mjs';
const FPS=24,DURATION=8,WIDTH=1280,HEIGHT=710;
const beats=[
 {id:'sales',title:'Sales agent',action:'Match the customer to a vehicle.',note:'Sample preferences → vehicle shortlist',target:new T.Vector3(-2.8,.7,2.5)},
 {id:'finance',title:'Finance enquiry',action:'Collect preferences. Never assume.',note:'Customer-stated information → staff review',target:new T.Vector3(3.3,.7,-1.4)},
 {id:'human',title:'Human handoff',action:'Your team makes the decisions.',note:'Verify stock, pricing and the next step',target:new T.Vector3(4.2,.7,2.6)}
];
const smooth=x=>{x=T.MathUtils.clamp(x,0,1);return x*x*(3-2*x);};
try{
 const scene=new T.Scene();scene.background=new T.Color('#101c23');
 const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
 renderer.setSize(WIDTH,HEIGHT);renderer.setPixelRatio(1);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.22;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
 document.querySelector('#stage').append(renderer.domElement);
 const model=buildShowroom(T,scene);
 scene.add(new T.HemisphereLight('#fff4df','#607b86',2.5));
 const sun=new T.DirectionalLight('#fff0d6',3.6);sun.position.set(-3,18,13);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-17,right:17,top:17,bottom:-17,far:55});sun.shadow.normalBias=.03;sun.shadow.bias=-.0002;scene.add(sun);
 const fill=new T.DirectionalLight('#b9dce7',1.3);fill.position.set(12,8,-5);scene.add(fill);
 for(const [x,z] of [[-7,-4],[0,-4],[7,-4],[7,3]]){const light=new T.PointLight('#ffcf8c',8,8,2);light.position.set(x,3,z);scene.add(light);}
 const camera=new T.OrthographicCamera(-15,15,10,-10,.1,150);
 // Rig only this captured instance; preserve its exact original meshes/materials.
 model.group.updateMatrixWorld(true);
 const rigs=model.roles.map(role=>{
   const original=[...role.group.children];
   const pivot=(x,y,z,parts)=>{const p=new T.Group();p.position.set(x,y,z);role.group.add(p);p.updateWorldMatrix(true,false);parts.forEach(mesh=>p.attach(mesh));return p;};
   const head=pivot(0,1.05,0,original.filter(m=>m.position.y>1.05));
   const arms=[-1,1].map(side=>pivot(side*.4,.83,0,original.filter(m=>m.position.x*side>.38&&m.position.y>.35&&m.position.y<1)));
   return {role,head,arms,baseY:role.group.position.y};
 });
 const label=document.querySelector('#label');
 window.motionInfo={fps:FPS,duration:DURATION,frames:Math.round(FPS*DURATION),width:WIDTH,height:960};
 window.renderFrame=index=>{
   const frame=T.MathUtils.clamp(Math.round(index),0,Math.round(FPS*DURATION)-1),t=frame/FPS;
   const phase=Math.min(2,Math.floor(t/(DURATION/3))),local=t-phase*(DURATION/3),beat=beats[phase];
   const previous=phase?beats[phase-1].target:new T.Vector3(0,.7,0);
   const target=previous.clone().lerp(beat.target,smooth(local/.8));
   const zoom=smooth(t/1.1),half=9.4+(6.8-9.4)*zoom,aspect=WIDTH/HEIGHT;
   camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();
   const azimuth=.68+.025*Math.sin(t*.7),elevation=.64;
   camera.position.set(target.x+30*Math.sin(azimuth)*Math.cos(elevation),target.y+30*Math.sin(elevation),target.z+30*Math.cos(azimuth)*Math.cos(elevation));camera.lookAt(target);camera.updateMatrixWorld();
   rigs.forEach((rig,i)=>{
     const active=rig.role.id===beat.id,amp=active?1:.26;
     rig.head.rotation.y=Math.sin(t*2.4+i)*.22*amp;rig.head.rotation.x=Math.sin(t*3.2+i)*.1*amp;
     rig.arms[0].rotation.x=-.2+Math.sin(t*4+i)*.28*amp;
     rig.arms[1].rotation.x=-.25+Math.sin(t*4+i+1.5)*.35*amp;
     rig.arms[1].rotation.z=active?-.42+.2*Math.sin(t*3):0;
     rig.role.group.rotation.y=Math.sin(t*1.7+i)*.1*amp;
     rig.role.group.position.y=rig.baseY+.018*Math.sin(t*4+i);
     rig.role.ring.visible=active;rig.role.ring.scale.setScalar(1+.13*Math.sin(t*5));
   });
   renderer.render(scene,camera);
   const role=model.roles.find(r=>r.id===beat.id),point=role.anchor.clone().add(new T.Vector3(0,.25,0)).project(camera);
   label.style.left=`${T.MathUtils.clamp((point.x+1)*WIDTH/2,160,WIDTH-160)}px`;
   label.style.top=`${T.MathUtils.clamp((1-point.y)*HEIGHT/2+110,180,760)}px`;
   label.replaceChildren(document.createTextNode(beat.title));const sub=document.createElement('small');sub.textContent='SCRIPTED ACTIVITY';label.append(sub);
   document.querySelector('#number').textContent=String(phase+1).padStart(2,'0');document.querySelector('#heading').textContent=beat.action;document.querySelector('#description').textContent=beat.note;
   document.querySelectorAll('.steps i').forEach((e,i)=>e.classList.toggle('active',i===phase));document.querySelector('#progress').style.width=`${(frame+1)/Math.round(FPS*DURATION)*100}%`;
   return {frame,phase,role:beat.id,head:rigs.find(r=>r.role.id===beat.id).head.rotation.y,arm:rigs.find(r=>r.role.id===beat.id).arms[1].rotation.x};
 };
 window.renderFrame(0);document.body.dataset.ready='true';
 window.addEventListener('pagehide',event=>{if(event.persisted)return;model.dispose();sun.shadow.dispose();renderer.dispose();});
}catch(error){document.querySelector('#error').hidden=false;document.querySelector('#error').textContent='Motion preview unavailable';window.motionError=String(error);}
