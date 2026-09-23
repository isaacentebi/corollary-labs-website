import sys
from PIL import Image
Image.MAX_IMAGE_PIXELS=None
src,prefix,n=sys.argv[1],sys.argv[2],int(sys.argv[3])
im=Image.open(src);w,h=im.size;print(im.size)
for i in range(n):
  c=im.crop((0,i*h//n,w,(i+1)*h//n));c.thumbnail((1400,1800));c.save(f'{prefix}{i}.png')
