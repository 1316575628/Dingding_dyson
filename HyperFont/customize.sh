#!/sbin/sh
# ============================================================
#  HyperFont — 澎湃OS 3 (HyperOS 3) 可变字体替换模块
#
#  原理: HyperOS 3 全部字重(100~950)均通过 MiSansVF*.ttf 的
#  wght 可变轴渲染, 不存在静态字重文件。本模块将用户字体合并
#  生成的可变字体(VF)替换以下文件, 不修改任何 xml 配置:
#    - MiSansVF_Overlay.ttf   (sans-serif 主字体)
#    - MiSansVF.ttf           (简体中文回退)
#    - MiSansLatinVF.ttf      (拉丁字符回退)
#  可选替换:
#    - RobotoFlex-Regular.ttf / Roboto-Regular.ttf (英文场景)
#  卸载模块并重启即恢复系统字体。
# ============================================================

# ---------- 可选配置 ----------
# 1 = 同时替换 RobotoFlex/Roboto (部分英文/原生组件场景); 0 = 仅 MiSans 系
REPLACE_ROBOTO=0

ui_print " "
ui_print "**************************************"
ui_print "     HyperFont for HyperOS 3 (VF)"
ui_print "**************************************"
ui_print " "
if [ "$KSU" = "true" ]; then
  ui_print "- 管理器: KernelSU"
elif [ -n "$MAGISK_VER" ]; then
  ui_print "- 管理器: Magisk v$MAGISK_VER"
else
  ui_print "- 管理器: 未知 (兼容模式)"
fi
ui_print "- 设备: $(getprop ro.product.marketname) ($(getprop ro.product.device))"
API=$(getprop ro.build.version.sdk)
ui_print "- 系统: $(getprop ro.mi.os.version.name)$(getprop ro.miui.ui.version.name) Android $(getprop ro.build.version.release) (API $API)"
ui_print " "

# ---------- 校验模块内置 VF 文件 ----------
# 魔数校验 (TTF=00010000 / OTF=OTTO / TTC=ttcf)
font_ok() {
  m=$(od -An -tx1 -N4 "$1" 2>/dev/null | tr -d ' \n')
  case "$m" in
    00010000|4f54544f|74746366) return 0;;
    *) return 1;;
  esac
}

# 可变字体必须含 fvar 表, 否则粗细滑块会失效
vf_ok() {
  grep -q "fvar" "$1" 2>/dev/null
}

ui_print "- 校验内置可变字体..."
VFDIR="$MODPATH/system/fonts"
CORE_OK=1
for f in MiSansVF_Overlay.ttf MiSansVF.ttf MiSansLatinVF.ttf; do
  p="$VFDIR/$f"
  if [ ! -f "$p" ]; then
    ui_print "! 缺少 $f, 模块打包不完整"
    CORE_OK=0
    continue
  fi
  if ! font_ok "$p"; then
    ui_print "! $f 魔数校验失败(文件损坏)"
    CORE_OK=0
    continue
  fi
  if ! vf_ok "$p"; then
    ui_print "! $f 缺少 fvar 表(不是可变字体), 滑块将失效"
    CORE_OK=0
    continue
  fi
  ui_print "  $f  OK"
done
[ "$CORE_OK" = "1" ] || abort "! 内置字体校验失败, 安装中止"
ui_print " "

# ---------- 校验设备环境 ----------
ui_print "- 校验系统字体环境..."
for f in MiSansVF_Overlay.ttf MiSansVF.ttf; do
  if [ ! -f "/system/fonts/$f" ]; then
    ui_print "! /system/fonts/$f 不存在"
    ui_print "! 本模块针对 HyperOS 3 (VF 字体架构) 设计"
    abort "! 请确认系统版本后反馈"
  fi
done
if [ ! -f "/system/fonts/MiSansLatinVF.ttf" ]; then
  ui_print "! 注意: /system/fonts/MiSansLatinVF.ttf 不存在 (继续安装, 拉丁场景可能不受影响)"
fi
ui_print "  环境校验通过"
ui_print " "

# ---------- Roboto 可选替换 ----------
if [ "$REPLACE_ROBOTO" = "1" ]; then
  ui_print "- 启用 Roboto 替换 (RobotoFlex / Roboto)"
  ui_print "  注意: 替换后部分原生组件英文将使用你的字体"
else
  rm -f "$VFDIR/RobotoFlex-Regular.ttf" "$VFDIR/Roboto-Regular.ttf"
fi
ui_print " "

# ---------- 清理与权限 ----------
set_perm_recursive "$MODPATH/system/fonts" 0 0 0755 0644

ui_print "- 安装完成! 重启后生效"
ui_print "- 卸载模块并重启即可恢复系统字体"
ui_print "- 简中/拉丁/滑块全档位已由可变字体接管"
ui_print "- 繁中/日文/韩文仍为系统 MiSans (避免缺字混排)"
ui_print " "
