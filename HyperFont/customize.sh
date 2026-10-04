#!/sbin/sh
# ============================================================
#  HyperFont — 澎湃OS 3 (HyperOS 3) 系统字体替换模块
#  将自定义字体(建议 5 个字重)自动就近映射, 覆盖系统 MiSans
#  全字重(可选取代 Roboto)。卸载模块并重启即恢复原字体。
# ============================================================

# ---------- 可选配置 ----------
# 1 = 同时替换 Roboto 英文字体(全局风格统一); 0 = 仅替换 MiSans
REPLACE_ROBOTO=0

SKIPUNZIP=0

ui_print " "
ui_print "**************************************"
ui_print "     HyperFont for HyperOS 3"
ui_print "**************************************"
ui_print " "
ui_print "- Magisk: v$MAGISK_VER (code $MAGISK_VER_CODE)"
ui_print "- 设备: $(getprop ro.product.marketname) ($(getprop ro.product.device))"
API=$(getprop ro.build.version.sdk)
ui_print "- 系统: $(getprop ro.mi.os.version.name)$(getprop ro.miui.ui.version.name) Android $(getprop ro.build.version.release) (API $API)"
ui_print " "

if [ "$API" -lt 34 ] 2>/dev/null; then
  ui_print "! 注意: 本模块针对 HyperOS 3 (Android 16) 设计"
  ui_print "! 当前系统版本较低, 将继续安装, 请自行确认效果"
  ui_print " "
fi

# ---------- 字重解析: 从文件名提取 weight 值 ----------
parse_weight() {
  n=$(echo "$1" | tr 'A-Z' 'a-z' | tr ' ' '-')
  case "$n" in
    *variable*|*vf*)            echo 400;;
    *thin*|*hairline*)          echo 100;;
    *extralight*|*extra-light*) echo 200;;
    *light*)                    echo 300;;
    *normal*)                   echo 350;;
    *regular*|*book*)           echo 400;;
    *medium*)                   echo 500;;
    *demibold*|*demi-bold*|*semibold*|*semi-bold*) echo 600;;
    *extrabold*|*extra-bold*)   echo 800;;
    *bold*)                     echo 700;;
    *heavy*|*black*)            echo 900;;
    *) echo "";;
  esac
}

# 魔数校验 (TTF=00010000 / OTF=OTTO / TTC=ttcf), 防止损坏文件拖垮系统字体服务
font_ok() {
  m=$(od -An -tx1 -N4 "$1" 2>/dev/null | tr -d ' \n')
  case "$m" in
    00010000|4f54544f|74746366) return 0;;
    *) return 1;;
  esac
}

# ---------- 读取用户字体 ----------
FONT_SRC="$MODPATH/fonts"
user_list=""   # "weight:path" 列表
vf_src=""      # 可变字体源(如有)

if [ ! -d "$FONT_SRC" ]; then
  abort "! 模块缺少 fonts/ 目录, 打包不完整"
fi

for f in "$FONT_SRC"/*; do
  [ -f "$f" ] || continue
  b=$(basename "$f")
  case "$b" in
    *.ttf|*.TTF|*.otf|*.OTF) ;;
    *) ui_print "! 忽略非字体文件: $b"; continue;;
  esac
  if ! font_ok "$f"; then
    ui_print "! 无效字体文件(魔数校验失败, 已跳过): $b"
    continue
  fi
  w=$(parse_weight "$b")
  if [ -z "$w" ]; then
    ui_print "! 无法识别字重(已跳过): $b"
    ui_print "!  文件名需包含 thin/light/normal/regular/medium/semibold/bold/heavy 等"
    continue
  fi
  user_list="$user_list $w:$f"
  case "$(echo "$b" | tr 'A-Z' 'a-z')" in
    *variable*|*vf*) vf_src="$f";;
  esac
done

n_user=$(echo $user_list | wc -w | tr -d ' ')
if [ "$n_user" -eq 0 ]; then
  ui_print "! 未找到任何可用字体文件!"
  ui_print "! 请将 5 个字重的 TTF/OTF 放入模块 zip 的 fonts/ 目录后重新打包"
  abort "! 安装中止"
fi

ui_print "- 已载入 $n_user 个字重的自定义字体:"
for it in $user_list; do
  ui_print "    $(basename ${it#*:})  (weight ${it%%:*})"
done
ui_print " "

# 就近匹配: 返回与目标 weight 最接近的用户字体路径
closest() {
  tw=$1; best=""; bd=100000
  for it in $user_list; do
    w=${it%%:*}; p=${it#*:}
    d=$((tw - w)); [ $d -lt 0 ] && d=$((0 - d))
    if [ $d -lt $bd ]; then bd=$d; best=$p; fi
  done
  echo "$best"
}

# ---------- 替换系统字体 ----------
mkdir -p "$MODPATH/system/fonts"
CNT=0

# $1: /system/fonts 下的 glob 模式
replace_family() {
  for tgt in /system/fonts/$1; do
    [ -f "$tgt" ] || continue
    base=$(basename "$tgt")
    low=$(echo "$base" | tr 'A-Z' 'a-z')
    case "$low" in
      *italic*) ui_print "- 保留斜体文件: $base"; continue;;
    esac
    tw=$(parse_weight "$base")
    if [ -z "$tw" ]; then
      ui_print "- 跳过(无法识别字重): $base"
      continue
    fi
    src=""
    case "$low" in
      *variable*|*vf*) [ -n "$vf_src" ] && src="$vf_src";;
    esac
    [ -z "$src" ] && src=$(closest "$tw")
    [ -z "$src" ] && continue
    cp -f "$src" "$MODPATH/system/fonts/$base"
    ui_print "- $base  <-  $(basename "$src")"
    CNT=$((CNT + 1))
  done
}

ui_print "- 正在映射 MiSans 字重..."
replace_family "MiSans*.ttf"
replace_family "MiSans*.otf"

if [ "$REPLACE_ROBOTO" = "1" ]; then
  ui_print " "
  ui_print "- 正在映射 Roboto 字重(英文)..."
  replace_family "Roboto-*.ttf"
fi

ui_print " "
if [ "$CNT" -eq 0 ]; then
  ui_print "! 未在 /system/fonts 中找到 MiSans 字体文件!"
  ui_print "! 请确认本机为 MIUI/HyperOS 系统"
  abort "! 安装中止"
fi
ui_print "- 共替换 $CNT 个系统字体文件"

# ---------- 清理与权限 ----------
rm -rf "$MODPATH/fonts"
set_perm_recursive "$MODPATH/system/fonts" 0 0 0755 0644

ui_print " "
ui_print "- 安装完成! 重启后生效"
ui_print "- 卸载模块并重启即可恢复系统字体"
ui_print "- 提示: 设置中的字体粗细滑块效果可能与原先略有差异(静态字重所致, 属正常)"
ui_print " "
