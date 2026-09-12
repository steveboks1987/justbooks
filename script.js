if (typeof window.globalData === 'undefined') {
    window.globalData = null;
}

// Hàm chuẩn hóa tiếng Việt (bỏ dấu và chuyển về chữ thường)
function removeVietnameseTones(str) {
    return str.normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/đ/g, 'd')
              .replace(/Đ/g, 'D')
              .toLowerCase();
}

document.addEventListener('DOMContentLoaded', () => {
    fetch('books.json')
        .then(response => response.json())
        .then(data => {
            window.globalData = data;
            const rootContainer = document.getElementById('library-root');
            rootContainer.innerHTML = '';
            rootContainer.appendChild(renderTree(data));
            
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.addEventListener('input', function(e) {
                    const keyword = e.target.value;
                    filterTree(keyword);
                });
            }
        })
        .catch(error => {
            const rootContainer = document.getElementById('library-root');
            if (rootContainer) {
                rootContainer.innerHTML = '<p style="color: red; text-align: center;">Chưa tìm thấy dữ liệu books.json hoặc chưa chạy xong script!</p>';
            }
            console.error('Lỗi:', error);
        });
});

// Hàm cập nhật số lượng và tự động ẩn/hiện thư mục theo kết quả lọc
function updateFolderCounts(folderBox) {
    const contentDiv = folderBox.querySelector(':scope > .folder-content');
    if (!contentDiv) return { totalDirs: 0, totalFiles: 0 };

    let visibleFiles = 0;
    const directBooks = contentDiv.querySelectorAll(':scope > .node-container > .book-list > .book-item');
    directBooks.forEach(item => {
        if (item.style.display !== 'none') {
            visibleFiles++;
        }
    });

    const subFolderBoxes = contentDiv.querySelectorAll(':scope > .node-container > .folder-box');
    let visibleDirs = 0;
    subFolderBoxes.forEach(subBox => {
        const subCounts = updateFolderCounts(subBox);
        visibleFiles += subCounts.totalFiles;
        if (subCounts.totalFiles > 0 || subCounts.totalDirs > 0) {
            visibleDirs++;
        }
    });

    const metaSpan = folderBox.querySelector(':scope > .folder-header > .folder-meta');
    if (metaSpan) {
        metaSpan.textContent = `(total dir: ${visibleDirs}, total file: ${visibleFiles})`;
    }

    // Nếu thư mục không có file nào và không có thư mục con nào chứa kết quả thì ẩn luôn
    if (visibleFiles === 0 && visibleDirs === 0) {
        folderBox.style.display = 'none';
    } else {
        folderBox.style.display = 'block';
    }

    return { totalDirs: visibleDirs, totalFiles: visibleFiles };
}

// Hàm đệ quy tính tổng gốc ban đầu
function countNodeItems(node) {
    let totalDirs = node.subfolders ? node.subfolders.length : 0;
    let totalFiles = node.books ? node.books.length : 0;

    if (node.subfolders) {
        node.subfolders.forEach(sub => {
            const counts = countNodeItems(sub);
            totalDirs += counts.totalDirs;
            totalFiles += counts.totalFiles;
        });
    }
    return { totalDirs, totalFiles };
}

// Hàm dựng cây thư mục đệ quy
function renderTree(node) {
    const container = document.createElement('div');
    container.className = 'node-container';

    if (node.books && node.books.length > 0) {
        const bookList = document.createElement('ul');
        bookList.className = 'book-list';
        
        node.books.forEach(book => {
            const li = document.createElement('li');
            li.className = 'book-item';
            
            const titleSpan = document.createElement('span');
            titleSpan.className = 'book-title';
            titleSpan.textContent = book.title;

            const linkBtn = document.createElement('a');
            linkBtn.className = 'btn-download';
            linkBtn.href = book.megaLink;
            linkBtn.target = '_blank';
            linkBtn.textContent = 'Tải sách';

            li.appendChild(titleSpan);
            li.appendChild(linkBtn);
            bookList.appendChild(li);
        });
        container.appendChild(bookList);
    }

    if (node.subfolders && node.subfolders.length > 0) {
        node.subfolders.forEach(subfolder => {
            const folderDiv = document.createElement('div');
            folderDiv.className = 'folder-box';

            const counts = countNodeItems(subfolder);
            const folderHeader = document.createElement('div');
            folderHeader.className = 'folder-header collapsed';
            folderHeader.innerHTML = `📁 <span>${subfolder.name}</span> <span class="folder-meta">(total dir: ${counts.totalDirs}, total file: ${counts.totalFiles})</span>`;
            
            const contentDiv = document.createElement('div');
            contentDiv.className = 'folder-content';
            contentDiv.style.display = 'none';
            contentDiv.appendChild(renderTree(subfolder));

            folderHeader.addEventListener('click', (e) => {
                e.stopPropagation();
                const isHidden = contentDiv.style.display === 'none';
                contentDiv.style.display = isHidden ? 'block' : 'none';
                folderHeader.classList.toggle('collapsed', !isHidden);
            });

            folderDiv.appendChild(folderHeader);
            folderDiv.appendChild(contentDiv);
            container.appendChild(folderDiv);
        });
    }

    return container;
}

// Kiểm tra xem tiêu đề có chứa tất cả các từ khóa tìm kiếm hay không (không phân biệt thứ tự và dấu)
function matchAllKeywords(title, keywords) {
    return keywords.every(keyword => title.includes(keyword));
}

// Lọc thông minh: Hỗ trợ tìm kiếm không cần liền mạch, ẩn thư mục trống và reset khi xóa trắng
function filterTree(keyword) {
    const keywordClean = keyword.trim();
    const rootContainer = document.getElementById('library-root');

    // Nếu xóa hết ký tự, vẽ lại cây ban đầu để khôi phục trạng thái và số lượng gốc
    if (keywordClean === "") {
        if (window.globalData) {
            rootContainer.innerHTML = '';
            rootContainer.appendChild(renderTree(window.globalData));
        }
        return;
    }

    // Tách từ khóa thành mảng các từ riêng biệt (ví dụ: "hoat dong 4" -> ["hoat", "dong", "4"])
    const normalizedKeyword = removeVietnameseTones(keywordClean);
    const keywordsArray = normalizedKeyword.split(/\s+/).filter(k => k.length > 0);

    const items = document.querySelectorAll('.book-item');

    items.forEach(item => {
        const titleSpan = item.querySelector('.book-title');
        const normalizedTitle = removeVietnameseTones(titleSpan.textContent);

        // Kiểm tra xem tất cả các từ khóa đều xuất hiện trong tên sách
        if (matchAllKeywords(normalizedTitle, keywordsArray)) {
            item.style.display = "flex";
            
            // Tự động mở rộng các thư mục chứa kết quả
            let parentContent = item.closest('.folder-content');
            while (parentContent) {
                parentContent.style.display = 'block';
                const header = parentContent.previousElementSibling;
                if (header && header.classList.contains('folder-header')) {
                    header.classList.remove('collapsed');
                }
                parentContent = parentContent.parentElement.closest('.folder-content');
            }
        } else {
            item.style.display = "none";
        }
    });

    // Cập nhật lại số liệu và ẩn các thư mục không có kết quả phù hợp
    const topFolderBoxes = rootContainer.querySelectorAll(':scope > .node-container > .folder-box');
    topFolderBoxes.forEach(box => {
        updateFolderCounts(box);
    });
}
// Xử lý sự kiện bật/tắt Modal Receive Crypto
document.addEventListener('DOMContentLoaded', () => {
    // Lưu ý: Đảm bảo các ID trong index.html khớp với script này
    const receiveBtn = document.getElementById('receive-btn');
    const receiveModal = document.getElementById('receive-modal');
    
    if (receiveBtn && receiveModal) {
        // Mở modal khi bấm nút nổi
        receiveBtn.addEventListener('click', () => {
            receiveModal.style.display = 'flex';
        });

        // Đóng modal khi bấm vào nút X
        const closeBtn = receiveModal.querySelector('.close-modal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                receiveModal.style.display = 'none';
            });
        }

        // Đóng modal khi click vào vùng nền tối bên ngoài
        window.addEventListener('click', (e) => {
            if (e.target === receiveModal) {
                receiveModal.style.display = 'none';
            }
        });
    }
});

// Hàm copy địa chỉ ví nhanh kèm thông báo phản hồi
function copyWallet(button) {
    const input = button.previousElementSibling;
    if (input) {
        input.select();
        input.setSelectionRange(0, 99999); // Hỗ trợ thiết bị di động
        navigator.clipboard.writeText(input.value);
        
        const originalText = button.textContent;
        button.textContent = "Đã copy!";
        button.style.backgroundColor = "#27ae60"; // Đổi màu xanh báo thành công
        
        setTimeout(() => {
            button.textContent = originalText;
            button.style.backgroundColor = ""; // Khôi phục màu gốc
        }, 2000);
    }
}