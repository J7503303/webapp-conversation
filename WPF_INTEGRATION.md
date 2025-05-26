# WPF应用集成说明

## 问题描述

WPF应用传递的URL参数中没有`record_type`参数，导致系统无法知道用户想要查看哪种病历类型的聊天记录。

## 解决方案

通过JavaScript全局函数来设置病历类型，WPF应用可以在WebView2加载完成后调用这些函数。

## 可用的JavaScript函数

### 1. 设置病历类型
```javascript
window.setRecordType('出院记录')
```

### 2. 清除病历类型设置
```javascript
window.clearRecordType()
```

### 3. 获取当前病历类型
```javascript
const currentType = window.getCurrentRecordType()
console.log('当前病历类型:', currentType)
```

## WPF应用调用示例

### C# 代码示例

```csharp
// 在WebView2加载完成后调用
private async void WebView_NavigationCompleted(object sender, CoreWebView2NavigationCompletedEventArgs e)
{
    if (e.IsSuccess)
    {
        // 设置病历类型为"出院记录"
        await webView.CoreWebView2.ExecuteScriptAsync("window.setRecordType('出院记录')");
    }
}

// 或者在需要切换病历类型时调用
private async void SwitchToOutpatientRecord()
{
    await webView.CoreWebView2.ExecuteScriptAsync("window.setRecordType('出院记录')");
}

private async void SwitchToInpatientRecord()
{
    await webView.CoreWebView2.ExecuteScriptAsync("window.setRecordType('入院记录')");
}

// 获取当前病历类型
private async void GetCurrentRecordType()
{
    string result = await webView.CoreWebView2.ExecuteScriptAsync("window.getCurrentRecordType()");
    Console.WriteLine($"当前病历类型: {result}");
}
```

## 支持的病历类型

- `入院记录`
- `出院记录`
- `首次病程记录`
- 其他自定义病历类型

## 调用时机

建议在以下时机调用：

1. **WebView2导航完成后** - 确保页面已加载完成
2. **用户切换病历类型时** - 响应用户操作
3. **页面刷新前** - 保存用户的选择

## 注意事项

1. 确保在页面完全加载后再调用这些函数
2. 病历类型会自动保存到localStorage，下次打开时会记住用户的选择
3. 调用`setRecordType`后会自动重新加载对应的聊天记录

## 测试方法

页面右上角有测试按钮，可以直接测试病历类型切换功能。 