// Khởi tạo Telegram WebApp
const tg = window.Telegram.WebApp;
tg.expand();

tg.MainButton.setParams({
    text: 'Đóng',
    color: '#0088cc'
});

tg.MainButton.onClick(() => {
    tg.close();
});

// Khởi tạo dữ liệu
let history = JSON.parse(localStorage.getItem('md5TaiXiuHistory')) || [];
let patterns = JSON.parse(localStorage.getItem('md5TaiXiuPatterns')) || {};

// Tab navigation
$('.tab').click(function() {
    $('.tab').removeClass('active');
    $(this).addClass('active');
    
    const tabId = $(this).data('tab');
    $('.tab-content').removeClass('active');
    $(`#${tabId}`).addClass('active');
    
    if (tabId === 'stats') {
        updateStats();
    } else if (tabId === 'history') {
        updateHistory();
    }
});

// Sử dụng event delegation cho tất cả collapsible
$(document).off('click', '.collapsible').on('click', '.collapsible', function() {
    $(this).toggleClass('active-collapsible');
    const content = $(this).next('.content');
    
    if ($(this).hasClass('active-collapsible')) {
        content.css('max-height', content[0].scrollHeight + "px").addClass('active');
    } else {
        content.css('max-height', null).removeClass('active');
    }
});

// Kiểm tra tính hợp lệ của mã MD5
function isValidMD5(md5) {
    return /^[a-fA-F0-9]{32}$/.test(md5);
}

// Hàm chuyển MD5 thành vector số
function md5ToVector(md5) {
    const hexChars = md5.toLowerCase().split('');
    return hexChars.map(char => parseInt(char, 16)); // Chuyển mỗi ký tự hex thành số nguyên (0-15)
}

// Hàm chuẩn hóa vector thành giá trị từ 0-1
function normalizeVector(vector) {
    // Tính tổng có trọng số
    let weightedSum = 0;
    for (let i = 0; i < vector.length; i++) {
        weightedSum += vector[i] * (i + 1);
    }
    
    // Chuẩn hóa về dải [0,1]
    return (weightedSum % 1000) / 1000;
}

// Ánh xạ giá trị chuẩn hóa sang tổng điểm xúc xắc (3-18)
function mapToDiceSum(normalizedValue) {
    // Ánh xạ từ [0,1] sang [3,18]
    return Math.floor(normalizedValue * 16) + 3;
}

// Tính giá trị của 3 xúc xắc từ tổng
function calculateDiceValuesFromSum(sum) {
    // Đảm bảo tổng nằm trong khoảng hợp lệ
    sum = Math.max(3, Math.min(18, sum));
    
    // Thuật toán đơn giản để tạo 3 giá trị xúc xắc
    const d1 = Math.min(6, Math.max(1, Math.floor(sum / 3)));
    const remaining = sum - d1;
    const d2 = Math.min(6, Math.max(1, Math.floor(remaining / 2)));
    const d3 = remaining - d2;
    
    return [d1, d2, d3];
}

// Hàm phân tích MD5
function analyzeMD5(md5) {
    if (!isValidMD5(md5)) {
        return null;
    }

    // Bước 1: Chuyển MD5 thành vector số nguyên
    const vector = md5ToVector(md5);
    
    // Bước 2: Chuẩn hóa vector và tính tổng hợp
    const normalizedValue = normalizeVector(vector);
    
    // Bước 3: Ánh xạ thành tổng điểm (3-18)
    const total = mapToDiceSum(normalizedValue);
    
    // Bước 4: Tính giá trị xúc xắc
    const dice = calculateDiceValuesFromSum(total);
    
    return {
        total: total,
        dice: dice,
        result: total >= 11 ? 'Tài' : 'Xỉu'
    };
}

// Cập nhật lại phần xử lý nút Phân Tích
$('#analyzeBtn').click(function() {
    const md5 = $('#md5Input').val().trim();
    const resultBox = $('#resultBox');
    
    if (!isValidMD5(md5)) {
        resultBox.html('<div class="error">Mã MD5 không hợp lệ</div>');
        resultBox.show();
        return;
    }
    
    const analysis = analyzeMD5(md5);
    
    // Hiển thị đơn giản chỉ với kết quả Tài/Xỉu
    resultBox.html(`
        <div class="result-summary ${analysis.result === 'Tài' ? 'tai-bg' : 'xiu-bg'}">
            <div><strong>MD5:</strong> ${md5}</div>
            <div><strong>Kết quả:</strong> <span class="${analysis.result === 'Tài' ? 'tai' : 'xiu'}">
                ${analysis.result}
            </span></div>
        </div>
    `);
    
    resultBox.show();
    $('.verify-section').show();
    
    // Lưu vào lịch sử
    history.unshift({
        md5: md5,
        result: analysis.result,
        total: analysis.total,
        dice: analysis.dice,
        timestamp: new Date().getTime(),
        lastThreeHex: md5.slice(-3)
    });
    
    localStorage.setItem('md5TaiXiuHistory', JSON.stringify(history));
    updateHistory();
});

// Xử lý nút xác minh kết quả
$('#verifyBtn').click(function() {
    const md5 = $('#md5Input').val().trim();
    const dice1 = parseInt($('#dice1').val());
    const dice2 = parseInt($('#dice2').val());
    const dice3 = parseInt($('#dice3').val());
    const verifyResultBox = $('#verifyResultBox');

    // Kiểm tra đầu vào
    if (isNaN(dice1) || isNaN(dice2) || isNaN(dice3) || 
        dice1 < 1 || dice1 > 6 || dice2 < 1 || dice2 > 6 || dice3 < 1 || dice3 > 6) {
        verifyResultBox.html('<div class="error">Vui lòng nhập giá trị xúc xắc hợp lệ (1-6)</div>');
        verifyResultBox.show();
        return;
    }

    // Tính tổng điểm
    const totalValue = dice1 + dice2 + dice3;
    const actualResult = totalValue >= 11 ? 'Tài' : 'Xỉu';
    const fullResult = `${actualResult} (${totalValue})`;

    // Tìm bản ghi gần nhất với MD5 này
    const recordIndex = history.findIndex(item => item.md5 === md5);
    if (recordIndex !== -1) {
        history[recordIndex].actualResult = fullResult;
        history[recordIndex].actualDice = [dice1, dice2, dice3];
        
        // Cập nhật patterns khi có kết quả thực tế
        const lastTwoHex = md5.slice(-2);
        if (!patterns[lastTwoHex]) {
            patterns[lastTwoHex] = { count: 0, tai: 0, xiu: 0 };
        }
        patterns[lastTwoHex].count++;
        if (actualResult === 'Tài') {
            patterns[lastTwoHex].tai++;
        } else {
            patterns[lastTwoHex].xiu++;
        }
        
        localStorage.setItem('md5TaiXiuHistory', JSON.stringify(history));
        localStorage.setItem('md5TaiXiuPatterns', JSON.stringify(patterns));
        
        verifyResultBox.html('<div class="success">Đã lưu kết quả xác minh thành công!</div>');
        verifyResultBox.show();
        
        // Xóa giá trị trong các trường nhập liệu
        $('#md5Input').val('');
        $('#dice1').val('');
        $('#dice2').val('');
        $('#dice3').val('');
        
        // Cập nhật lại lịch sử và thống kê
        updateHistory();
        updateStats();
    } else {
        verifyResultBox.html('<div class="error">Không tìm thấy bản ghi MD5 tương ứng</div>');
        verifyResultBox.show();
    }
});

// Xử lý nút xóa lịch sử
$('#clearHistoryBtn').click(function() {
    if (confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử?')) {
        history = [];
        patterns = {};
        localStorage.removeItem('md5TaiXiuHistory');
        localStorage.removeItem('md5TaiXiuPatterns');
        updateHistory();
        updateStats();
    }
});

// Xử lý tìm kiếm trong lịch sử
$('#historySearch').on('input', function() {
    const searchTerm = $(this).val().trim();
    updateHistory(searchTerm);
});

// Xác thực MD5 trong trường input
$('#md5Input').on('input', function() {
    const md5 = $(this).val().trim();
    if (md5.length > 0 && !isValidMD5(md5)) {
        $(this).css('border-color', 'var(--danger)');
    } else {
        $(this).css('border-color', '#ddd');
    }
});

// Cập nhật hiển thị lịch sử
function updateHistory(searchTerm = '') {
    const historyList = $('#historyList');
    historyList.empty();
    
    if (history.length === 0) {
        historyList.html('<div class="message">Chưa có dữ liệu lịch sử</div>');
        return;
    }
    
    const filteredHistory = searchTerm ? 
        history.filter(item => item.md5.includes(searchTerm)) : 
        history;
    
    if (filteredHistory.length === 0) {
        historyList.html('<div class="message">Không tìm thấy kết quả phù hợp</div>');
        return;
    }
    
    filteredHistory.forEach((item, index) => {
        if (index >= 50) return; // Giới hạn hiển thị 50 mục
        
        const date = new Date(item.timestamp);
        const dateStr = date.toLocaleDateString('vi-VN');
        const timeStr = date.toLocaleTimeString('vi-VN');
        
        const hasActual = item.actualResult !== undefined;
        const actualMatchesPredicted = hasActual && item.actualResult.startsWith(item.result);
        
        const itemClass = hasActual ? 
            (actualMatchesPredicted ? 'matched' : 'not-matched') : '';
        
        historyList.append(`
            <div class="history-item ${itemClass}">
                <div class="history-header">
                    <span>${dateStr} ${timeStr}</span>
                    ${hasActual ? 
                        `<span class="badge ${actualMatchesPredicted ? 'badge-success' : 'badge-danger'}">
                            ${actualMatchesPredicted ? 'Đúng' : 'Sai'}
                        </span>` : ''}
                </div>
                <div><strong>MD5:</strong> ${item.md5}</div>
                <div>
                    <strong>Dự đoán:</strong> 
                    <span class="${item.result === 'Tài' ? 'tai' : 'xiu'}">${item.result}</span>
                    (${item.total})
                </div>
                ${hasActual ? `<div><strong>Thực tế:</strong> ${item.actualResult}</div>` : ''}
            </div>
        `);
    });
}

// Cập nhật thống kê
function updateStats() {
    // Các biến tổng hợp
    let totalRecords = 0;
    let verifiedRecords = 0;
    let correctPredictions = 0;
    let taiCount = 0;
    let xiuCount = 0;
    const diceDistribution = Array(16).fill(0); // Lưu trữ phân phối điểm từ 3-18
    
    // Tính toán thống kê
    history.forEach(item => {
        totalRecords++;
        
        // Thống kê điểm
        const diceIndex = item.total - 3; // Chuyển từ 3-18 sang 0-15
        if (diceIndex >= 0 && diceIndex < 16) {
            diceDistribution[diceIndex]++;
        }
        
        // Đếm tài/xỉu
        if (item.result === 'Tài') {
            taiCount++;
        } else {
            xiuCount++;
        }
        
        // Đếm dự đoán chính xác
        if (item.actualResult) {
            verifiedRecords++;
            if (item.actualResult.startsWith(item.result)) {
                correctPredictions++;
            }
        }
    });
    
    // Hiển thị thống kê tổng quan
    $('#totalRecords').text(totalRecords);
    const accuracyRate = verifiedRecords > 0 ? (correctPredictions / verifiedRecords * 100).toFixed(1) : '0';
    $('#accuracyRate').text(accuracyRate + '%');
    
    const taiRate = totalRecords > 0 ? (taiCount / totalRecords * 100).toFixed(1) : '0';
    const xiuRate = totalRecords > 0 ? (xiuCount / totalRecords * 100).toFixed(1) : '0';
    $('#taiRate').text(taiRate + '%');
    $('#xiuRate').text(xiuRate + '%');
    
    // Vẽ biểu đồ phân phối điểm
    const chartContainer = $('#diceDistributionChart');
    chartContainer.empty();
    
    const maxValue = Math.max(...diceDistribution);
    const containerWidth = chartContainer.width() || 300;
    const barWidth = Math.floor((containerWidth - 32) / 16) - 2;
    
    for (let i = 0; i < 16; i++) {
        const value = diceDistribution[i];
        const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
        const height = Math.max(5, percentage); // Tối thiểu 5px để có thể nhìn thấy
        
        const barClass = i + 3 >= 11 ? 'tai' : 'xiu';
        
        chartContainer.append(`
            <div class="bar ${barClass}" style="
                left: ${i * (barWidth + 2) + 16}px;
                width: ${barWidth}px;
                height: ${height}%;
                ${barClass === 'tai' ? 'background-color: #4CAF50;' : 'background-color: #F44336;'}
            ">
                <div class="bar-label">${i + 3}</div>
            </div>
        `);
    }
    
    // Hiển thị danh sách mẫu MD5
    const patternsList = $('#patternsList');
    patternsList.empty();
    
    const sortedPatterns = Object.entries(patterns)
        .filter(([_, data]) => data.count >= 3)
        .sort((a, b) => b[1].count - a[1].count);
    
    if (sortedPatterns.length === 0) {
        patternsList.html('<div class="message">Chưa có đủ dữ liệu mẫu</div>');
        return;
    }
    
    let patternsHtml = '<table><thead><tr><th>Mẫu</th><th>Số lần</th><th>Tài</th><th>Xỉu</th></tr></thead><tbody>';
    
    sortedPatterns.slice(0, 20).forEach(([pattern, data]) => {
        const taiPercentage = (data.tai / data.count * 100).toFixed(1);
        const xiuPercentage = (data.xiu / data.count * 100).toFixed(1);
        
        patternsHtml += `
            <tr>
                <td><span class="hex-highlight">${pattern}</span></td>
                <td>${data.count}</td>
                <td>${data.tai} (${taiPercentage}%)</td>
                <td>${data.xiu} (${xiuPercentage}%)</td>
            </tr>
        `;
    });
    
    patternsHtml += '</tbody></table>';
    patternsList.html(patternsHtml);
}

// Khởi tạo ban đầu
$(document).ready(function() {
    updateHistory();
    updateStats();
});