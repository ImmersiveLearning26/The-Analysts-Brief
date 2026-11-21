"""Reference geometry generator, not final production art.
Run: blender --background --python blender/make_reference_geometry.py -- --out blender/generated
All axes and numbers come from layout.json. No external packages required.
"""
import bpy,math,json,sys,argparse
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
p=argparse.ArgumentParser();p.add_argument('--out',default=str(ROOT/'generated'));a=p.parse_args(args)
OUT=Path(a.out).resolve();OUT.mkdir(parents=True,exist_ok=True)
D=json.loads((ROOT/'layout.json').read_text())
def reset():
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 bpy.context.scene.unit_settings.system='METRIC';bpy.context.scene.unit_settings.scale_length=1
 bpy.context.scene.render.fps=30
 bpy.context.scene.world.color=(.18,.18,.18)
def mat(name,color):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=.7
 return m
def box(name,size,pos,material,parent=None):
 bpy.ops.mesh.primitive_cube_add(size=1,location=pos);o=bpy.context.object;o.name=name;o.dimensions=size
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if material:o.data.materials.append(material)
 if parent:o.parent=parent
 return o
def empty(name,pos=(0,0,0)):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=pos;return o
def line(name,points,width,material):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=width;c.bevel_resolution=2
 s=c.splines.new('POLY');s.points.add(len(points)-1)
 for pt,co in zip(s.points,points):pt.co=(*co,1)
 o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);o.data.materials.append(material);return o
def save(name):
 bpy.ops.wm.save_as_mainfile(filepath=str(OUT/(name+'.blend')))
 bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'.glb')),export_format='GLB',export_yup=True,export_animations=True)
def make_folder():
 reset();paper=mat('Paper',(.90,.87,.79));buff=mat('BuffCard',(.65,.48,.30));green=mat('FoundationsTag',(.53,.61,.46));blue=mat('AsideTag',(.45,.53,.60))
 root=empty('FOLDER_Root');box('FOLDER_Back',(.24,.32,.002),(0,0,0),buff,root)
 hinge=empty('FOLDER_Hinge',D['folder']['hinge']);hinge.parent=root
 cover=box('FOLDER_Cover',(.24,.32,.002),(.12,0,0),buff,hinge)
 for i in range(3):box(f'PAPER_{i+1:02}',D['folder']['paper_size'],(0,0,.002+i*.0005),paper,root)
 box('TAG_Foundations',D['folder']['tag_size'],(.084,.14,.004),green,root)
 tag=box('TAG_SetAside',D['folder']['tag_size'],(.084,.115,.004),blue,root);tag.hide_render=True
 hinge.rotation_euler.y=0;hinge.keyframe_insert(data_path='rotation_euler',frame=1)
 hinge.rotation_euler.y=math.radians(D['folder']['open_degrees']);hinge.keyframe_insert(data_path='rotation_euler',frame=19)
 hinge.animation_data.action.name='Folder_Open';bpy.context.scene.frame_end=19;bpy.context.scene.frame_set(1)
 save('folder_reference')
def make_map():
 reset();earth=mat('Terrain',(.44,.49,.34));stone=mat('Civic',(.72,.69,.59));army=mat('Barracks',(.41,.46,.37));roof=mat('Canopy',(.68,.47,.27));water=mat('River',(.38,.48,.51));metal=mat('Mast',(.42,.43,.42))
 poly=D['map']['outline'];n=len(poly);h=D['map']['thickness'];verts=[(x,y,z) for z in [0,h] for x,y in poly]
 faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
 mesh=bpy.data.meshes.new('KAL_BaseMesh');mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new('KAL_Base',mesh);bpy.context.collection.objects.link(o);o.data.materials.append(earth)
 for it in D['map']['objects']:
  x,y,z=it['position'];w,d,hh=it['size'];name=it['name']
  if name=='KAL_Market':
   for j in range(4):
    xx=x-w/2+(j+.5)*w/4
    box(f'KAL_Stall_{j+1:02}',(.048,.06,.018),(xx,y,z+.009),roof)
    box(f'KAL_Canopy_{j+1:02}',(.055,.075,.005),(xx,y,z+.055),roof)
    for dx in [-.02,.02]:box(f'KAL_StallPost_{j+1}_{dx}',(.003,.003,.05),(xx+dx,y,z+.025),metal)
  else:box(name,(w,d,hh),(x,y,z+hh/2),army if 'Barracks' in name else stone)
 box('KAL_Mast',(.008,.008,.19),(.03,.24,h+.045+.095),metal)
 line('KAL_River',[(x,y,h+.001) for x,y in D['map']['river']],.009,water)
 line('KAL_Road',[(-.27,.10,h+.002),(-.10,0,h+.002),(.10,-.19,h+.002),(.27,.13,h+.002)],.005,stone)
 for it in D['map']['objects']:empty('HOTSPOT_'+it['name'],it['position'])
 save('kalinda_reference')
def camera(name,entry):
 bpy.ops.object.camera_add(location=entry['position']);o=bpy.context.object;o.name=name;o.data.lens=entry['lens_mm'];o.rotation_euler=(Vector(entry['target'])-o.location).to_track_quat('-Z','Y').to_euler();bpy.context.scene.camera=o
 return o
def room(kind):
 reset();wall=mat('Plaster',(.72,.70,.65));wood=mat('Oak',(.40,.28,.18));seat=mat('Chair',(.27,.28,.25));entry=D[kind];w,d,h=entry['size']
 box(kind+'_Floor',(w,d,.08),(0,0,-.04),wall)
 # Full room retained; split walls for artist access, never expose a cutaway in final learner camera.
 box(kind+'_WallBack',(w,.10,h),(0,d/2,h/2),wall)
 box(kind+'_WallLeft',(.10,d,h),(-w/2,0,h/2),wall);box(kind+'_WallRight',(.10,d,h),(w/2,0,h/2),wall)
 pos=entry.get('table_center',entry.get('desk_center'));sz=entry.get('table_size',entry.get('desk_size'));box(kind+'_Desk',sz,pos,wood)
 for dx in [-sz[0]/2+.08,sz[0]/2-.08]:
  for dy in [-sz[1]/2+.08,sz[1]/2-.08]:box(kind+'_DeskLeg',(.06,.06,.73),(pos[0]+dx,pos[1]+dy,.365),wood)
 if kind=='hall':
  for row in range(3):
   for col in range(6):
    x=(col-2.5)*.8+(-.5 if col<3 else .5);y=-.4+row
    box(f'HALL_Chair_{row}_{col}_Seat',(.42,.42,.045),(x,y,.45),seat)
    box(f'HALL_Chair_{row}_{col}_Back',(.42,.05,.4),(x,y+.2,.67),seat)
  camera('CAM_Hall',D['cameras']['CAM_Hall'])
 else:
  for name in ['CAM_OfficeEntry','CAM_Desk','CAM_Document','CAM_Model','CAM_ChairOffice']:camera(name,D['cameras'][name])
 bpy.ops.object.light_add(type='AREA',location=(-2,-1,2.8));bpy.context.object.data.energy=450;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=4
 save(kind+'_reference')
make_folder();make_map();room('office');room('hall')
print('REFERENCE_GEOMETRY_COMPLETE',OUT)
