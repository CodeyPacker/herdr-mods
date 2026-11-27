import re,sys
KW=r'int|double|bool|var|null|void|struct|override|virtual|abstract|async|await|foreach|nameof|typeof'
PATTERNS=[
 r'[A-Za-z_]\w*\??(?:\.[A-Za-z_]\w*)+(?:\([^()\s]*\))?',      # member access / calls: Console.WriteLine, x.Length, Sample.Movies()
 r'[A-Z]\w*<[^<>]*(?:<[^<>]*>[^<>]*)*>(?:\?)?',              # generic types: List<int>, Dictionary<string, int>
 r'\b[A-Za-z_]\w*\([^()]{0,40}\)',                            # calls: Describe(), Average(new double[0])
 r'\b\w+Exception\b',
 r'(?<![\w`])(?:'+KW+r')(?![\w`])',
 r'"[^"\n]{0,40}"',
]
TOKEN=re.compile('|'.join('(?:%s)'%p for p in PATTERNS))
def fix_prose(line):
    out=[]; parts=re.split(r'(`[^`]*`)',line)
    for i,part in enumerate(parts):
        if i%2: out.append(part); continue
        out.append(TOKEN.sub(lambda m: '`%s`'%m.group(0), part))
    s=''.join(out)
    return re.sub(r'``+',lambda m:'`' if len(m.group(0))==2 else m.group(0),s).replace('``','')
def polish(text):
    lines=text.split('\n'); end=lines.index('---',1); out=lines[:end+1]; fence=None; inq=False
    for l in lines[end+1:]:
        if fence:
            out.append(l); fence=None if l.strip()==fence else fence; continue
        m=re.match(r'^(`{3,})',l)
        if m: fence=m.group(1); out.append(l); continue
        if l.startswith(('@','## ',':::')): out.append(l); continue
        if l.startswith('- [') and ' :: ' in l:
            head,rest=l[:6],l[6:]; text,fb=rest.split(' :: ',1)
            out.append(head+fix_prose(text)+' :: '+fix_prose(fb)); continue
        out.append(fix_prose(l))
    return '\n'.join(out)
for p in sys.argv[1:]:
    s=open(p).read(); open(p,'w').write(polish(s))
