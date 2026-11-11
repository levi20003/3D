# Laptop stand v2: 2 free-standing truss brackets, no cross braces. Wide feet for lateral stability.
# Profile in XY, extruded in Z: print flat, no supports.
import math, sys, trimesh
from shapely.geometry import Polygon, LineString
from shapely.ops import unary_union

L=180.0      # bracket depth (mm)
ANG=25.0     # tilt (deg)
ZF=16.0      # surface height at the lip
LIP_T, LIP_H = 5.0, 12.0
T=8.0        # bracket thickness
W=5.5        # strut width
PANELS=3
FOOT_L, FOOT_H, FOOT_W = 28.0, 5.0, 36.0   # foot length, height, total width (across)

tn=math.tan(math.radians(ANG))
zt=lambda x: ZF+(x-LIP_T)*tn
ZB=zt(L)
outer=Polygon([(0,0),(L,0),(L,ZB),(LIP_T,ZF),(LIP_T,ZF+LIP_H),(0,ZF+LIP_H)])
outer=outer.buffer(-2,join_style=1).buffer(2,join_style=1)
xs=[LIP_T+2+i*(L-LIP_T-4)/PANELS for i in range(PANELS+1)]
lines=[]
for i in range(PANELS):
    xm=(xs[i]+xs[i+1])/2
    lines+=[LineString([(xs[i],W/2),(xm,zt(xm)-W/2)]),LineString([(xm,zt(xm)-W/2),(xs[i+1],W/2)])]
struts=unary_union([l.buffer(W/2,cap_style=1) for l in lines])
holes=outer.buffer(-W,join_style=2).difference(struts)
holes=holes.buffer(-1.5,join_style=1).buffer(1.5,join_style=1)
holes=unary_union([g for g in getattr(holes,'geoms',[holes]) if g.area>60])
prof=outer.difference(holes)

bracket=trimesh.creation.extrude_polygon(prof,T)
# Feet: wide pads at front and back (stand up as posts when printing flat)
feet=[]
for x0 in (0.0, L-FOOT_L):
    f=Polygon([(x0,0),(x0+FOOT_L,0),(x0+FOOT_L,FOOT_H),(x0,FOOT_H)]).buffer(-1,join_style=1).buffer(1,join_style=1)
    m=trimesh.creation.extrude_polygon(f,FOOT_W); m.apply_translation((0,0,T/2-FOOT_W/2)); feet.append(m)
part=trimesh.boolean.union([bracket]+feet,engine="manifold")
part.apply_translation((0,0,-part.bounds[0][2]))
solid=trimesh.creation.extrude_polygon(outer,T)

out=sys.argv[1] if len(sys.argv)>1 else "."
part.export(f"{out}/laptoptarto_oldal_x2.stl")
asm=[]
for y0 in (0,200):
    b=part.copy(); b.apply_transform(trimesh.transformations.rotation_matrix(math.pi/2,(1,0,0))); b.apply_translation((0,y0+FOOT_W,0)); asm.append(b)
trimesh.util.concatenate(asm).export(f"{out}/laptoptarto_osszeallitas.stl")
print(f"watertight={part.is_watertight} part={part.volume/1000:.1f}cm3 (solid plate would be {solid.volume/1000:.1f}), pair={2*part.volume/1000:.1f}cm3, back height {ZB:.0f} mm, height@front {ZF:.0f}")
