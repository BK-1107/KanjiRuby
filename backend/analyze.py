from fugashi import Tagger # 分词器
import re # 正则表达式
from deep_translator import GoogleTranslator # 翻译器

# 初始化 MeCab 分词器 (Tagger)
# fugashi 会自动查找已安装的词典 (如 unidic-lite)
tagger = Tagger()

# 正则表达式：用于匹配常见的 CJK 统一表意文字 (即汉字)
# 范围 \u4e00-\u9fa5 (在 Python 中可写为 [一-龯] 等变体，这里使用一-龯覆盖基本汉字区)
KANJI_RE = re.compile(r"[一-龯]")

# 检查字符串中是否包含汉字。
def has_kanji(text: str) -> bool:
    return bool(KANJI_RE.search(text))


# 片假名 -> 平假名 转换函数
def katakana_to_hiragana(text: str) -> str:
    if not text:
        return text
    result = []
    for ch in text:
        code = ord(ch)
        # 片假名 Unicode 范围通常在 0x30A1-0x30F6 (ァ-ヶ)
        # 平假名对应字符偏移量为 -0x60 (96)
        if 0x30A1 <= code <= 0x30F6:
            result.append(chr(code - 0x60))
        else:
            result.append(ch)
    return "".join(result)


# 翻译函数：将日语翻译为中文
def translate_text(text: str) -> str:
    try:
        translated = GoogleTranslator(source='ja', target='zh-CN').translate(text)
        return translated
    except Exception as e:
        print(f"翻译出错: {e}")
        return ""


def analyze_text(text: str):
    """
    分析日语文本，返回分词结果列表。
    每个词包含：原文、读音 (假名)、词性、是否包含汉字等信息。
    """
    result = []

    # 使用 tagger 对文本进行分词
    # tagger(text) 返回一个可迭代 of word 对象列表
    for word in tagger(text):
        # 提取前置空白字符（如空格、换行），防止丢失排版结构
        ws = getattr(word, "white_space", "")
        if ws:
            result.append({
                "surface": ws,
                "reading": ws,
                "pos": "空白",
                "has_kanji": False,
                "ruby": False,
                "selected": False,
                "translation": None
            })

        # surface: 单词的表面形式 (即原文中的写法)
        surface = word.surface

        # 获取读音 (reading)
        # 在 UniDic 中，'kana' 字段通常存储片假名读音。
        # 注意：word.feature 是一个 UnidicFeatures26 对象，需要用属性访问，而不是 .get()
        # getattr(obj, 'name', default) 用于安全获取属性，防止报错
        reading_katakana = getattr(word.feature, 'kana', None)
        
        # 如果读音为 None 或 "*" (表示未知)，则将其设为原文 (surface)
        if reading_katakana in (None, "*"):
            reading = surface
        else:
            # 将片假名转换为平假名 (如 "ニッポン" -> "にっぽん")
            reading = katakana_to_hiragana(reading_katakana)

        # 获取词性 (Part of Speech)
        # pos1 通常是词性大类 (如 名詞, 動詞)
        pos = getattr(word.feature, 'pos1', None)

        # 构建结果字典
        result.append({
            "surface": surface,       # 原文 (如 "日本語")
            "reading": reading,       # 读音 (如 "にっぽん")
            "pos": pos,               # 词性 (如 "名詞")
            "has_kanji": has_kanji(surface),  # 是否含汉字 (True/False)
            "ruby": has_kanji(surface),       # UI 辅助字段：默认对含汉字的词显示注音 (ruby)
            "selected": False,        # UI 辅助字段：是否被用户选中
            "translation": None       # 占位符：后续可能填入翻译结果
        })

    return result
