import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

here = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description='Rebuild the three warrior options and scale comparison.')
parser.add_argument('--output', type=Path, default=here / 'drafts')
parser.add_argument('--font', default='/System/Library/Fonts/AppleSDGothicNeo.ttc')
parser.add_argument('--font-index', type=int, default=5)
args = parser.parse_args()

pack = here.parents[3] / 'src/game/assets/preview-packs'
out = args.output
out.mkdir(parents=True, exist_ok=True)
def load(name):
    return Image.open(pack/name).convert('RGBA')
def recolor(image, palette):
    result = image.copy()
    result.putdata([(*palette.get(p[:3],p[:3]), p[3]) for p in image.getdata()])
    return result

old = load('mini/warrior.png')
compact = old.resize((23,20),Image.Resampling.NEAREST)
puny = recolor(load('puny/warrior.png'), {
    (54,54,54):(52,57,70),(77,76,75):(87,99,120),(125,123,118):(135,151,165),
    (162,158,150):(171,193,201),(190,187,181):(221,236,230),
    (174,0,0):(178,62,55),(82,12,12):(107,38,44),(255,21,21):(244,94,74),
})
duelist = Image.new('RGBA',(23,20))
duelist.alpha_composite(puny,(2,5))
d = ImageDraw.Draw(duelist)
d.polygon([(13,15),(19,4),(22,1),(22,6),(17,15),(16,16)],fill='#263344')
d.polygon([(15,14),(20,5),(21,3),(21,6),(17,14)],fill='#abcddd')
d.line([(16,13),(20,5)],fill='#f8f9ec')
d.line([(13,14),(18,17)],fill='#3d2b29',width=2)
d.line([(14,14),(17,16)],fill='#e7ac55')
d.line([(15,16),(13,19)],fill='#5b3940',width=2)
knight = recolor(load('ninja/warrior.png'),{
    (141,151,127):(155,181,197),(95,113,96):(73,102,132),
    (59,54,67):(44,58,82),(78,72,74):(68,81,108),
    (224,57,76):(89,171,225),(209,75,52):(180,115,57),
    (239,145,79):(232,170,80),(45,105,123):(53,100,174),
    (84,135,137):(97,153,217),
})
archer, mage = load('mini/archer.png'), load('mini/mage.png')
terrain = load('mini/terrain.png')
cx = terrain.width//2
stage = terrain.crop((cx-178,300,cx+178,463)).convert('RGB')
def font(size):
    return ImageFont.truetype(args.font, size, index=args.font_index)
canvas = Image.new('RGB',(786,566),'#ddecde')
d = ImageDraw.Draw(canvas)
for i,(name,description,hero) in enumerate([
    ('현재 전사','기존 크기 비교용',old),
    ('A  붉은 방패 기사','기존 실루엣을 20픽셀로 축소',compact),
    ('B  붉은 망토 검객','궁수·마법사와 같은 원본 팩 · 가는 장검',duelist),
    ('C  청은 기사','푸른 투구와 은빛 검 · 가장 압축된 체격',knight),
]):
    x=11+(i%2)*388
    y=11+(i//2)*278
    d.rounded_rectangle((x,y,x+375,y+262),radius=10,fill='#f6fcf6',outline='#a8c5b4',width=2)
    d.text((x+13,y+10),name,font=font(24),fill='#174b38')
    d.text((x+13,y+40),description,font=font(16),fill='#375a4d')
    canvas.paste(stage,(x+10,y+69))
    for j,(label,figure) in enumerate([('전사',hero),('궁수',archer),('마법사',mage)]):
        middle=x+66+j*122
        feet=y+177
        d.ellipse((middle-17,feet-3,middle+17,feet+4),fill='#b9a66f')
        scaled=figure.resize((figure.width*2,figure.height*2),Image.Resampling.NEAREST)
        canvas.paste(scaled,(middle-scaled.width//2,feet-scaled.height),scaled)
        d.text((middle,y+199),label,font=font(16),fill='#2a3830',anchor='mm')
    bounds=hero.getbbox()
    d.text((x+12,y+239),f'전사 스프라이트 높이 {bounds[3]-bounds[1]}px · 전원 게임과 같은 2배 표시',font=font(13),fill='#4d6e60')
    if i:
        hero.save(out/f'warrior-option-{"ABC"[i-1]}.png')
canvas.save(out/'warrior-options.png')
