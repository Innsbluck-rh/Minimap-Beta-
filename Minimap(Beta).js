//Minimap MOD By Innsbluck
//()

var activity = com.mojang.minecraftpe.MainActivity.currentMainActivity.get(),
    terrain_atlas_file,
    terrain_atlas_bitmap;

function newLevel() {
    //ファイルを取ってくる
    terrain_atlas_file = new java.io.File(android.os.Environment.getExternalStorageDirectory().getAbsolutePath() + "/games/com.mojang/Minimap-Images/terrain-atlas.png");
    terrain_atlas_bitmap = android.graphics.BitmapFactory.decodeFile(terrain_atlas_file.getAbsolutePath());

    //マップのGUIのセットアップ
    map.setup();
}

function modTick() {
    //セットアップが終了していれば
    if (map.setupFinished) {
        //更新が終わっているなら再度更新
        if (!map.updating) {
            map.updateMap();
        }

        map.gui.runUiCode(function() {
            map.gui.mapImage.setRotation((-Entity.getYaw(getPlayerEnt()) % 360) + 180);
        });
    }
}

var map = function() {
    var members = {};
    members.setupFinished = false;
    members.updating = false;
    members.radius = 5;
    members.diam = members.radius * 2 + 1;
    members.allBlockBitmaps = {};

    members.setup = function() {
        activity.runOnUiThread(new java.lang.Runnable() {
            run: function() {
                try {
                    var my = {},
                        mapSetting = false;
                    //マップの画像
                    my.mapImage = new android.widget.ImageButton(activity);
                    my.mapLayout = new android.widget.FrameLayout(activity);
                    my.rootWindow = new android.widget.PopupWindow();
                    my.mapOptionLayout = new android.widget.LinearLayout(activity);
                    my.mapOptionDialog = new android.app.AlertDialog.Builder(activity);

                    var mapImage_lp = new android.widget.FrameLayout.LayoutParams(
                        32 * map.diam, 32 * map.diam
                    );
                    my.mapImage.setLayoutParams(mapImage_lp);
                    my.mapImage.setAdjustViewBounds(true);
                    my.mapImage.setScaleType(android.widget.ImageView.ScaleType.FIT_XY);
                    my.mapImage.setBackgroundColor(android.graphics.Color.TRANSPARENT);
                    var imageLongClicked = new android.view.View.OnLongClickListener({
                        onLongClick: function(view) {
                            if (mapSetting) {
                                mapSetting = false;
                                clientMessage("設定を確定しますた");
                            } else {
                                mapSetting = true;
                                clientMessage("設定を開始しますた");
                            }
                            return true;
                        }
                    });
                    my.mapImage.setOnLongClickListener(imageLongClicked);


                    var dx = 0,
                        dy = 0,
                        currentX = 0,
                        currentY = 0;
                    my.mapImage.setOnTouchListener(new android.view.View.OnTouchListener({
                        onTouch: function(view, event) {
                            try {
                                if (mapSetting) {
                                    var action = event.getAction();
                                    if (action == android.view.MotionEvent.ACTION_DOWN) {
                                        dx = currentX - event.getRawX();
                                        dy = currentY - event.getRawY();
                                    } else if (action == android.view.MotionEvent.ACTION_MOVE) {
                                        currentX = event.getRawX() + dx;
                                        currentY = event.getRawY() + dy;
                                        my.rootWindow.update(currentX, currentY, -1, -1);
                                    }
                                }
                                return false;
                            } catch (error) {
                                clientMessage(error);
                            }
                        }
                    }));

                    my.mapLayout.addView(my.mapImage);

                    my.rootWindow.setContentView(my.mapLayout);
                    my.rootWindow.setWindowLayoutMode(
                        android.view.ViewGroup.LayoutParams.WRAP_CONTENT,
                        android.view.ViewGroup.LayoutParams.WRAP_CONTENT);
                    my.rootWindow.setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(android.graphics.Color.TRANSPARENT));
                    my.rootWindow.showAtLocation(activity.getWindow().getDecorView(), android.view.Gravity.TOP | android.view.Gravity.LEFT, 0, 0);

                    //UIスレッドで実行
                    my.runUiCode = function(code) {
                        activity.runOnUiThread(new java.lang.Runnable() {
                            run: function() {
                                try {
                                    code();
                                } catch (error) {
                                    clientMessage(error);
                                }
                            }
                        });
                    };

                    members.gui = my;
                    members.setupFinished = true;
                } catch (error) {
                    clientMessage(error);
                }
            }
        });
    };

    members.createBlockBitmap = function(blockId, damage) {
        try {
            var texDataArray = Block.getTextureCoords(
                    blockId, BlockFace.UP, damage
                ),
                texDataObject = {
                    startX: texDataArray[0],
                    startY: texDataArray[1],
                    endX: texDataArray[2],
                    endY: texDataArray[3],
                    maxX: texDataArray[4],
                    maxY: texDataArray[5]
                },
                blockBitmap = members.getBitmapFromTerrainAtlas(
                    texDataObject.startX, texDataObject.startY,
                    texDataObject.endX, texDataObject.endY
                );

            //ブロックIDのグループがなければ作成
            if (members.allBlockBitmaps[blockId] === undefined) {
                members.allBlockBitmaps[blockId] = {};
            }
            //ブロックのビットマップを選別する
            var filteredBlockBitmap = map.blockBitmapFilter(blockId, damage, blockBitmap);
            //追加
            members.allBlockBitmaps[blockId][damage] = filteredBlockBitmap;
            return true;
        } catch (error) {
            return false;
        }
    };

    members.updateMap = function() {
        members.updating = true;
        var mapBitmap = android.graphics.Bitmap.createBitmap(
                16 * members.diam,
                16 * members.diam, android.graphics.Bitmap.Config.ARGB_8888
            ),
            mapCanvas = new android.graphics.Canvas(mapBitmap),
            playerX = Player.getX(),
            playerY = Player.getY() - 2,
            playerZ = Player.getZ(),
            wid_i, hei_i;

        var updatingThread = new java.lang.Thread(new java.lang.Runnable({
            run: function() {
                for (wid_i = 0; wid_i <= members.diam; wid_i++) {
                    for (hei_i = 0; hei_i <= members.diam; hei_i++) {
                        var currentX = playerX + (wid_i - members.radius),
                            currentZ = playerZ + (hei_i - members.radius),
                            mapBlockData = members.getTopBlock(currentX, playerY, currentZ);

                        if (!members.isCreatedBitmap(mapBlockData.id, mapBlockData.damage)) {
                            if (!members.createBlockBitmap(mapBlockData.id, mapBlockData.damage)) {
                                continue;
                            }
                        }

                        var originMapBlockBitmap = members.allBlockBitmaps[mapBlockData.id][mapBlockData.damage];
                        var replicMapBlockBitmap = originMapBlockBitmap.copy(originMapBlockBitmap.getConfig(), true);
                        var mapBlockCanvas = new android.graphics.Canvas(replicMapBlockBitmap);
                        var paint = new android.graphics.Paint();
                        if (mapBlockData.foundedY < playerY) {
                            paint.setColor(android.graphics.Color.argb(
                                (playerY - mapBlockData.foundedY) * 10,
                                0, 0, 0));
                        } else {
                            paint.setColor(android.graphics.Color.argb(
                                (mapBlockData.foundedY - playerY) * 10,
                                255, 255, 255));
                        }
                        mapBlockCanvas.drawRect(0, 0, 16, 16, paint);
                        mapCanvas.drawBitmap(replicMapBlockBitmap, wid_i * 16, hei_i * 16, null);
                    }
                }

                var circleMapBitmap = createCircleBitmap(mapBitmap);

                members.gui.runUiCode(function() {
                    members.gui.mapImage.setImageBitmap(circleMapBitmap);
                });
                members.updating = false;
            }
        }));
        updatingThread.start();
    };

    //ビットマップが作成されているか
    members.isCreatedBitmap = function(id, damage) {
        if (members.allBlockBitmaps[id] === undefined) {
            return false;
        }
        if (members.allBlockBitmaps[id][damage] === undefined) {
            return false;
        }
        return true;
    }

    var findingRenderTypes = [0, 4, 31]

    //最上部のブロックを取得
    members.getTopBlock = function(x, py, z) {
        py = Math.round(py);
        var cy = 0;
        var isTopTile = function(y) {
            var id = Level.getTile(x, y, z),
                renderType = Block.getRenderType(id),
                topId = Level.getTile(x, y + 1, z),
                topRenderType = Block.getRenderType(topId);
            if (findingRenderTypes.indexOf(topRenderType) == -1 &&
                findingRenderTypes.indexOf(renderType) != -1) {
                var damage = Level.getData(x, y, z);
                return {
                    id: id,
                    damage: damage,
                    foundedY: y
                };
            } else {
                return false;
            }
        }
        while (cy < 25) {
            var onPlus = isTopTile(cy + py),
                onMinus = isTopTile(-cy + py);
            if (onPlus) {
                return onPlus;
            }
            if (onMinus) {
                return onMinus;
            }
            cy += 1;
        }
        return {
            id: 0,
            damage: 0,
            foundedY: 0
        };
    };

    members.blockBitmapFilter = function(blockId, damage, bitmap) {
        switch (blockId) {
            case 2:
                return members.getBitmapFromTerrainAtlas(16 * 2, 0, 16 * 3, 16 * 1);
                break;
            case 18:
                return members.getBitmapFromTerrainAtlas(16 * 27, 16 * 4, 16 * 28, 16 * 5);
                break;
            default:
                return bitmap;
                break;
        }
    }

    members.getBitmapFromTerrainAtlas = function(startX, startY, endX, endY) {
        return android.graphics.Bitmap.createBitmap(
            terrain_atlas_bitmap, startX, startY,
            endX - startX, endY - startY
        );
    }

    return members;
}();

function createCircleBitmap(bitmap) {
    var width = bitmap.getWidth();
    var height = bitmap.getHeight();
    var outputBitmap = android.graphics.Bitmap.createBitmap(width, height, android.graphics.Bitmap.Config.ARGB_8888);

    var path = new android.graphics.Path();
    path.addCircle(
        (width / 2),
        (height / 2),
        Math.min(width, (height / 2)),
        android.graphics.Path.Direction.CCW
    );

    var canvas = new android.graphics.Canvas(outputBitmap);
    canvas.clipPath(path);
    canvas.drawBitmap(bitmap, 0, 0, null);
    return outputBitmap;
}
