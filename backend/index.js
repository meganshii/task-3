const express = require('express');
const multer = require('multer');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const key = require('./secrets-key.json');

const app = express();

app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
    optionsSuccessStatus: 204,
  })
);

const storage = multer.diskStorage({
  destination: 'uploads',
  filename: function (req, file, callback) {
    const extension = file.originalname.split(".").pop();
    callback(null, `${file.fieldname}-${Date.now()}.${extension}`);
  }
});

const upload = multer({ storage: storage });

const getOrCreateFolder = async (drive, folderName, parentFolderId) => {
  const folderResponse = await drive.files.list({
    q: `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and '${parentFolderId}' in parents`,
    fields: 'files(id, name)',
    spaces: 'drive',
  });

  if (folderResponse.data.files.length > 0) {
    return folderResponse.data.files[0].id;
  }

  const folderMetadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [parentFolderId]
  };

  const folder = await drive.files.create({
    resource: folderMetadata,
    fields: 'id',
  });

  return folder.data.id;
};

// Google Drive API setup
const auth = new google.auth.GoogleAuth({
  keyFile: path.join(__dirname, 'secrets-key.json'), // Provide the correct path to the key file
  scopes: ["https://www.googleapis.com/auth/drive", "https://www.googleapis.com/auth/spreadsheets"],
});

const drive = google.drive({
  version: 'v3',
  auth,
});

const sheetsAuth = new google.auth.GoogleAuth({
  keyFile: path.join(__dirname, 'sheetkey.json'), // Provide the correct path to the sheetclient.json file
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth: sheetsAuth });


const SHEET_ID = '1x8vIB_PuX00-rtd0u1fAPqJBO7X0Rqz6T4XYrIHWOYI'; // Replace with your Google Sheet ID

const addLinkToSheet = async (fileLink) => {
  const request = {
    spreadsheetId: SHEET_ID,
    range: 'Sheet1!A:A', // Modify as per your sheet structure
    valueInputOption: 'USER_ENTERED',
    resource: {
      values: [[fileLink]],
    },
  };

  await sheets.spreadsheets.values.append(request);
};

const deleteLinkFromSheet = async (fileLink) => {
  const getRequest = {
    spreadsheetId: SHEET_ID,
    range: 'Sheet1!A:A', // Modify as per your sheet structure
  };

  const getResponse = await sheets.spreadsheets.values.get(getRequest);
  const rows = getResponse.data.values;
  const rowIndex = rows.findIndex(row => row[0] === fileLink);

  if (rowIndex !== -1) {
    const deleteRequest = {
      spreadsheetId: SHEET_ID,
      range: `Sheet1!A${rowIndex + 1}`,
      resource: {
        values: [['']],
      },
      valueInputOption: 'USER_ENTERED',
    };
    await sheets.spreadsheets.values.update(deleteRequest);
  }
};

app.post('/upload', upload.array('files'), async (req, res) => {
  const { tabLabel } = req.body; // Receive tab label from the request

  try {
    const parentFolderId = '1aOVUpatsDirhtG348SqQlOaLL4elpOps'; // Replace with your parent folder ID
    const folderId = await getOrCreateFolder(drive, tabLabel, parentFolderId);

    const uploadedFiles = [];
    for (let file of req.files) {
      const response = await drive.files.create({
        requestBody: {
          name: file.originalname,
          mimeType: file.mimetype,
          parents: [folderId]
        },
        media: {
          body: fs.createReadStream(file.path),
        }
      });

      // Delete the file from the server after uploading to Drive
      fs.unlinkSync(file.path);

      const webViewLink = `https://drive.google.com/file/d/${response.data.id}/view?usp=drive_link`;
      uploadedFiles.push({
        id: response.data.id,
        webViewLink: webViewLink,
      });

      // Add the file link to Google Sheets
      await addLinkToSheet(webViewLink);
    }

    res.status(200).json({ files: uploadedFiles });

  } catch (error) {
    console.error('Error during file upload:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

app.delete('/delete/:fileId', async (req, res) => {
  const fileId = req.params.fileId;

  try {
    // Get the file metadata to fetch the webViewLink before deleting
    const file = await drive.files.get({
      fileId: fileId,
      fields: 'webViewLink',
    });

    // Delete the file from the Drive
    await drive.files.delete({ fileId: fileId });

    // Delete the corresponding link from the Google Sheet
    await deleteLinkFromSheet(file.data.webViewLink);

    res.status(200).send({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).send({ message: 'Error deleting file', error });
  }
});



const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
