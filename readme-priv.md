Nếu deploy trên Render:

Vào service backend → Disks → Add Disk
Đặt:
Name: zen-dictation-data
Mount Path: /var/data
Size: tùy nhu cầu, ví dụ 1 GB
Thêm Environment Variable:

Start command:

Database sẽ nằm tại:


Các file SQLite WAL/SHM cũng sẽ được lưu cùng thư mục persistent disk.

Nếu dùng Railway/Fly.io/Docker, mount volume vào /data, rồi đặt:


Điểm quan trọng: DATA_DIR phải là thư mục mount, không phải tên file.

README và code đã được cập nhật tại server.mjs và