"""Dimensioned orthographic construction plates, not AI perspective estimates."""
import json,math
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon,Rectangle,FancyBboxPatch
ROOT=Path(__file__).resolve().parent;OUT=ROOT.parent/'design/orthographic';OUT.mkdir(exist_ok=True)
D=json.loads((ROOT/'layout.json').read_text())
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10})
def fig(title,n=3):
 f,aa=plt.subplots(1,n,figsize=(18,7),facecolor='#f7f7f3');f.suptitle(title,fontsize=20,x=.04,ha='left',y=.96)
 for ax in aa:ax.set_facecolor('#f7f7f3');ax.set_aspect('equal');ax.grid(alpha=.15);ax.set_xlabel('metres');ax.set_ylabel('metres')
 return f,aa
def save(f,name,note):
 f.text(.04,.035,note,fontsize=10,color='#55575e');f.tight_layout(rect=[.02,.10,.98,.9]);f.savefig(OUT/(name+'.png'),dpi=160);f.savefig(OUT/(name+'.svg'));plt.close(f)
f,aa=fig('01 / Kalinda tabletop — orthographic construction views')
p=D['map']['outline'];ax=aa[0];ax.add_patch(Polygon(p,fc='#b3b99f',ec='#262721'));ax.set_title('TOP · X / Y');ax.set_xlim(-.7,.7);ax.set_ylim(-.48,.48)
ax.plot([p[0] for p in D['map']['river']],[p[1] for p in D['map']['river']],color='#72929b',lw=3)
colors=['#cbbca8','#8d967e','#a6aaab','#bf966d']
for i,it in enumerate(D['map']['objects']):
 x,y,z=it['position'];w,d,h=it['size'];ax.add_patch(Rectangle((x-w/2,y-d/2),w,d,fc=colors[i],ec='#262721'));ax.text(x,y,it['name'].replace('KAL_',''),ha='center',va='center',fontsize=8)
for j,(idx,name) in enumerate([(0,'FRONT · X / Z'),(1,'RIGHT · Y / Z')],1):
 ax=aa[j];width=1.2 if idx==0 else .8;ax.add_patch(Rectangle((-width/2,0),width,.025,fc='#b3b99f',ec='#262721'))
 for i,it in enumerate(D['map']['objects']):
  v=it['position'][idx];w=it['size'][idx];h=it['size'][2];ax.add_patch(Rectangle((v-w/2,.025),w,h,fc=colors[i],ec='#262721'))
 ax.plot([.03 if idx==0 else .24]*2,[.07,.26],color='#55575e',lw=2);ax.set_xlim(-width/2-.1,width/2+.1);ax.set_ylim(-.05,.32);ax.set_title(name)
save(f,'01_kalinda_map','Base: 1.20 × 0.80 m envelope; 25 mm thick. Symbolic institutional layout, not a geographic or causal claim. All placements: blender/layout.json.')
f,aa=fig('02 / Document tag — flat label with a short folded edge')
ax=aa[0];ax.add_patch(FancyBboxPatch((0,0),.046,.018,boxstyle='round,pad=0,rounding_size=0.002',fc='#c5d0b8',ec='#262721'));ax.text(.023,.009,'Foundations',ha='center',va='center',fontsize=8);ax.set_title('TOP · label face');ax.set_xlim(-.008,.054);ax.set_ylim(-.012,.03)
for ax,label in zip(aa[1:],['FRONT · thickness exaggerated in line weight','RIGHT · short folded edge']):
 span=.018 if label.startswith('RIGHT') else .046
 ax.plot([0,span,span],[.0005,.0005,-.002],color='#69745a',lw=3);ax.set_xlim(-.008,.054);ax.set_ylim(-.012,.03);ax.set_title(label,fontsize=10)
save(f,'02_document_tags','Tag face: 46 × 18 mm, 0.5 mm thick, 2 mm corner radius. Foundations sage #C5D0B8; Set aside blue-grey #B9C6CF. Text stays editable in app.')
f,aa=fig('03 / Folder and extracted page — orthographic construction views')
ax=aa[0];ax.add_patch(Rectangle((0,0),.24,.32,fc='#cfb28c',ec='#262721'));ax.add_patch(Rectangle((.015,.0115),.21,.297,fc='#f3eddd',ec='#262721'));ax.plot([0,0],[0,.32],color='#f28c38',lw=3);ax.set_xlim(-.04,.28);ax.set_ylim(-.04,.37);ax.set_title('TOP · closed, cover hidden')
ax=aa[1];ax.plot([0,.24],[0,0],color='#896a45',lw=3);angle=math.radians(165);ax.plot([0,.24*math.cos(angle)],[.004,.004+.24*math.sin(angle)],color='#896a45',lw=3);ax.scatter([0],[.004],color='#f28c38');ax.set_xlim(-.27,.28);ax.set_ylim(-.08,.20);ax.set_title('FRONT · 165° cover opening')
ax=aa[2];ax.add_patch(Rectangle((0,0),.32,.008,fc='#cfb28c',ec='#262721'));ax.set_xlim(-.04,.36);ax.set_ylim(-.08,.20);ax.set_title('RIGHT · closed stack')
save(f,'03_folder','Closed cover: 240 × 320 mm. A4 page: 210 × 297 mm. Hinge runs along Y at X = −120 mm in centred local coordinates. Separate cover, spine, paper and tag.')
f,aa=fig('04 / School hall — reuse office furniture, build a simple shell')
ax=aa[0];ax.add_patch(Rectangle((-5,-4),10,8,fill=False,ec='#262721'));ax.add_patch(Rectangle((-1.2,-2.5),2.4,.8,fc='#cbbca8',ec='#262721'))
for row in range(3):
 for col in range(6):
  x=(col-2.5)*.8+(-.5 if col<3 else .5);y=-.4+row;ax.add_patch(Rectangle((x-.21,y-.21),.42,.42,fc='#bbbeb5',ec='#262721'))
ax.scatter([0],[-2.9],c='#f28c38');ax.annotate('learner eyes',(0,-2.9),(.8,-3.5),arrowprops={'arrowstyle':'->'});ax.set_xlim(-5.5,5.5);ax.set_ylim(-4.5,4.5);ax.set_title('TOP · 10 × 8 m; centre aisle')
ax=aa[1];ax.add_patch(Rectangle((-5,0),10,3.5,fill=False));ax.plot([-1.2,1.2],[.75,.75],lw=3,color='#896a45');ax.scatter([0],[1.2],c='#f28c38');ax.set_xlim(-5.5,5.5);ax.set_ylim(-.3,4);ax.set_title('FRONT · seated eye level 1.20 m')
ax=aa[2];ax.add_patch(Rectangle((-4,0),8,3.5,fill=False));ax.plot([-2.5,-1.7],[.75,.75],lw=3,color='#896a45');ax.scatter([-2.9],[1.2],c='#f28c38');ax.plot([-2.9,.7],[1.2,1.2],color='#f28c38',ls='--');ax.set_xlim(-4.5,4.5);ax.set_ylim(-.3,4);ax.set_title('RIGHT · level sightline into hall')
save(f,'04_hall','18 seats, 3 rows. Keep foreground clear. Attendees optional background dressing, never a gameplay dependency. First person; no external isometric cutaway.')
f,aa=fig('05 / Office cameras — first-person positions, metres')
ax=aa[0];ax.add_patch(Rectangle((-3,-2.5),6,5,fill=False));ax.add_patch(Rectangle((-.9,-.55),1.8,1.1,fc='#cbbca8',ec='#262721'));ax.set_xlim(-3.3,3.3);ax.set_ylim(-2.8,2.8);ax.set_title('TOP · camera positions')
for name,e in D['cameras'].items():
 if name=='CAM_Hall':continue
 x,y,z=e['position'];ax.scatter([x],[y]);ax.text(x+.1,y,name.replace('CAM_',''),fontsize=7)
ax=aa[1];ax.plot([-.9,.9],[.75,.75],color='#896a45',lw=3);ax.scatter([0],[1.2],c='#f28c38');ax.set_xlim(-1.4,1.4);ax.set_ylim(0,1.9);ax.set_title('FRONT · typical seated eyes')
ax=aa[2]
for name,e in D['cameras'].items():
 if name=='CAM_Hall':continue
 _,y,z=e['position'];_,ty,tz=e['target'];ax.plot([y,ty],[z,tz],label=name.replace('CAM_',''))
ax.plot([-.55,.55],[.75,.75],color='#896a45',lw=3);ax.set_xlim(-2.6,.7);ax.set_ylim(0,1.9);ax.set_title('RIGHT · look-at paths');ax.legend(fontsize=7)
save(f,'05_first_person_cameras','Camera remains inside room. Object tilt supplies isometric inspection. Orthographic cameras are for production guides only, not player exploration.')
