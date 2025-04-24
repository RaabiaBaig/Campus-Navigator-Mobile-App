import numpy as np

def trilaterate(p1,d1,p2,d2,p3,d3):
    P1,P2,P3 = np.array(p1),np.array(p2),np.array(p3)
    ex=(P2-P1)/np.linalg.norm(P2-P1)
    i=np.dot(ex,P3-P1)
    ey=(P3-P1-i*ex)/np.linalg.norm(P3-P1-i*ex)
    d=np.linalg.norm(P2-P1); j=np.dot(ey,P3-P1)
    x=(d1**2-d2**2+d**2)/(2*d)
    y=(d1**2-d3**2+i**2+j**2)/(2*j)-(i/j)*x
    pos=P1+x*ex+y*ey
    return (round(pos[0],2), round(pos[1],2))
