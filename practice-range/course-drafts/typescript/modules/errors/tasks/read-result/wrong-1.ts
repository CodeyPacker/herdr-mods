function readText(source: () => string): Result {
  try { const text=source(); return text ? {kind:"ok",text} : {kind:"error",message:"Unknown"}; }
  catch {return {kind:"error",message:"Unknown"};}
}
