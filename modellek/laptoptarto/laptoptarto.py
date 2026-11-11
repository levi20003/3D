# Laptop stand: 2 truss side brackets + 2 cross braces. Profile in XY, extruded in Z (print flat, no supports).
import math, sys, trimesh
from shapely.geometry import Polygon, LineString, box
from shapely.ops import unary_union

L=200.0      # bracket depth (mm)
ANG=18.0     # tilt (deg)
ZF=18.0      # surface height at the lip
LIP_T, LIP_H = 6.0, 12.0
T=12.0       # bracket thickness
W=7.0        # strut width
SPAN=180.0   # outer distance between brackets = brace length
BR_W, BR_H, CLR = 10.0, 6.0, 0.15   # brace cross-section and slot clearance
PANELS=4

tn=math.tan(math.radians(ANG))
zt=lambda x: ZF+(x-LIP_T)*tn          # top surface height
ZB=zt(L)
outer=Polygon([(0,0),(L,0),(L,ZB),(LIP_T,ZF),(LIP_T,ZF+LIP_H),(0,ZF+LIP_H)])
outer=outer.buffer(-2,join_style=1).buffer(2,join_style=1)   # rounded corners

# Warren truss lines between base and top nodes
xs=[LIP_T+3+i*(L-LIP_T-6)/PANELS for i in range(PANELS+1)]
lines=[]
for i in range(PANELS):
    xm=(xs[i]+xs[i+1])/2
    lines+=[LineString([(xs[i],W/2),(xm,zt(xm)-W/2)]),LineString([(xm,zt(xm)-W/2),(xs[i+1],W/2)])]
struts=unary_union([l.buffer(W/2,cap_style=1) for l in lines])

# Brace nodes: solid pads with slots
nodes=[(L*0.5,9.0),(L-11.0,ZB*0.45)]
pads=unary_union([box(x-12,z-9,x+12,z+9) for x,z in nodes])
slots=unary_union([box(x-(BR_W/2+CLR),z-(BR_H/2+CLR),x+(BR_W/2+CLR),z+(BR_H/2+CLR)) for x,z in nodes])

inner=outer.buffer(-W,join_style=2)
holes=inner.difference(struts).difference(pads)
holes=holes.buffer(-1.5,join_style=1).buffer(1.5,join_style=1)  # fillet hole corners
holes=unary_union([g for g in getattr(holes,'geoms',[holes]) if g.area>60])  # drop tiny pockets
prof=outer.difference(holes).difference(slots)

bracket=trimesh.creation.extrude_polygon(prof,T)
solid=trimesh.creation.extrude_polygon(outer,T)
# Brace: flat bar with chamfer-free ends, printed flat
brace=trimesh.creation.box((SPAN,BR_W,BR_H)); brace.apply_translation((SPAN/2,BR_W/2,BR_H/2))

out=sys.argv[1] if len(sys.argv)>1 else "."
bracket.export(f"{out}/laptoptarto_oldal_x2.stl"); brace.export(f"{out}/laptoptarto_merevito_x2.stl")
# Assembly preview
asm=[]
for y0 in (0,SPAN-T):
    b=bracket.copy(); b.apply_transform(trimesh.transformations.rotation_matrix(math.pi/2,(1,0,0))); b.apply_translation((0,y0+T,0)); asm.append(b)
for x,z in nodes:
    br=trimesh.creation.box((BR_W,SPAN,BR_H)); br.apply_translation((x,SPAN/2,z)); asm.append(br)
trimesh.util.concatenate(asm).export(f"{out}/laptoptarto_osszeallitas.stl")
v=2*bracket.volume+2*brace.volume; vs=2*solid.volume
print(f"bracket watertight={bracket.is_watertight} vol={bracket.volume/1000:.1f}cm3, solid={solid.volume/1000:.1f}cm3, saved={100*(1-bracket.volume/solid.volume):.0f}%")
print(f"total {v/1000:.1f} cm3 ~ {v/1000*1.24:.0f} g PLA at 100% (slicer infill lowers it); height back {ZB:.0f} mm")
