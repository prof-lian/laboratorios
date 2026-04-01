// INICIALIZANDO O FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyBsneCiBIWfZUk_xXrFafXu2kAQIc4JhD0",
    authDomain: "laboratoriojgg.firebaseapp.com",
    projectId: "laboratoriojgg",
    storageBucket: "laboratoriojgg.firebasestorage.app",
    messagingSenderId: "858172326287",
    appId: "1:858172326287:web:7bab8c1b080ab27f134bfa"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let todosAgendamentosCache = []; 
const mesesNomes = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
const diasSemanaNomes = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

const ordemHorarios = [
    "1º Horário (07:00 - 07:50)", "2º Horário (07:50 - 08:40)", "3º Horário (08:40 - 09:30)", "4º Horário (09:45 - 10:35)", "5º Horário (10:35 - 11:25)",
    "1º Hor. Vesp (13:00 - 13:50)", "2º Hor. Vesp (13:50 - 14:40)", "3º Hor. Vesp (14:40 - 15:30)", "4º Hor. Vesp (15:45 - 16:35)", "5º Hor. Vesp (16:35 - 17:25)"
];

// Identifica a página atual baseada no ID principal da tela
function identificarPagina() {
    if (document.getElementById('grade-dias')) return 'index';
    if (document.getElementById('tela-formulario')) return 'agendar';
    if (document.getElementById('grade-dias-lista')) return 'visualizar';
    if (document.getElementById('tela-admin')) return 'admin';
    return null;
}

const urlParams = new URLSearchParams(window.location.search);
const dataUrl = urlParams.get('data');
const idEditUrl = urlParams.get('idEdit');

function formatarHorario(h) {
    if (h.includes("1º Horário (07")) return "1º";
    if (h.includes("2º Horário (07")) return "2º";
    if (h.includes("3º Horário (08")) return "3º";
    if (h.includes("4º Horário (09")) return "4º";
    if (h.includes("5º Horário (10")) return "5º";
    if (h.includes("1º Hor. Vesp")) return "1º"; 
    if (h.includes("2º Hor. Vesp")) return "2º";
    if (h.includes("3º Hor. Vesp")) return "3º";
    if (h.includes("4º Hor. Vesp")) return "4º";
    if (h.includes("5º Hor. Vesp")) return "5º";
    return h;
}

function ordenarHorarios(arrayHorarios) {
    return arrayHorarios.sort((a, b) => ordemHorarios.indexOf(a) - ordemHorarios.indexOf(b));
}

// ================= ADMIN =================
const SENHA_ADMIN = "Jgg2026@";
function solicitarSenhaAdmin() {
    let senha = prompt("Acesso restrito. Digite a senha:");
    if (senha === SENHA_ADMIN) {
        sessionStorage.setItem("adminAutorizado", "true");
        window.location.href = "admin.html";
    } else if (senha !== null) alert("❌ Senha incorreta!");
}

function alternarTodosHorariosAdmin(source) {
    document.querySelectorAll('input[name="admin-horario"]').forEach(cb => cb.checked = source.checked);
}

async function salvarBloqueioAdmin() {
    const dataRaw = document.getElementById("admin-data-bloqueio").value; 
    const motivo = document.getElementById("admin-motivo-bloqueio").value.trim() || "Fechado pelo Administrador";
    const responsavel = document.getElementById("admin-responsavel").value.trim();
    const checkboxes = document.querySelectorAll('input[name="admin-horario"]:checked');
    let horariosSelecionados = Array.from(checkboxes).map(cb => cb.value);

    if(!dataRaw) return alert("⚠️ Selecione uma data.");
    if(horariosSelecionados.length === 0) return alert("⚠️ Selecione um horário.");

    let partes = dataRaw.split('-');
    let dataFormatada = `${partes[2]}/${partes[1]}/${partes[0]}`;
    let descricaoFinal = responsavel ? `${motivo} (Resp: ${responsavel})` : motivo;

    try {
        await db.collection("agendamentos").add({
            data: dataFormatada, nomeProfessor: "🔒 BLOQUEADO", telefone: "-", disciplina: "Fechado", 
            descricaoAula: descricaoFinal, horarios: horariosSelecionados, dataRegistro: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert(`✅ Bloqueio salvo!`);
        document.getElementById("admin-data-bloqueio").value = ""; 
        document.getElementById("admin-motivo-bloqueio").value = "";
        document.getElementById("admin-responsavel").value = "";
        checkboxes.forEach(cb => cb.checked = false);
        document.getElementById('chk-marcar-todos').checked = false; 
    } catch (erro) { alert("❌ Erro ao bloquear."); }
}

function editarReserva(id) {
    // Redireciona para a página de formulário passando o ID para edição
    window.location.href = `agendar.html?idEdit=${id}`;
}

async function excluirReserva(idRegistro) {
    if(confirm("⚠️ Deseja cancelar esta reserva/bloqueio?")) {
        try { await db.collection("agendamentos").doc(idRegistro).delete(); } 
        catch(e) { alert("❌ Erro ao remover."); }
    }
}

// ================= CALENDÁRIO INICIAL (index.html) =================
let dataAtual = new Date(); let mesAtual = dataAtual.getMonth(); let anoAtual = dataAtual.getFullYear();

function atualizarBotoesMes() {
    let mesAnt = mesAtual - 1 < 0 ? 11 : mesAtual - 1;
    let mesProx = mesAtual + 1 > 11 ? 0 : mesAtual + 1;
    document.getElementById("btn-mes-ant").innerText = "< " + mesesNomes[mesAnt].substring(0,3);
    document.getElementById("btn-mes-prox").innerText = mesesNomes[mesProx].substring(0,3) + " >";
}

function mudarMes(delta) {
    mesAtual += delta;
    if (mesAtual > 11) { mesAtual = 0; anoAtual++; }
    if (mesAtual < 0) { mesAtual = 11; anoAtual--; }
    gerarCalendario();
}

function gerarCalendario() {
    if(identificarPagina() !== 'index') return;
    document.getElementById("mes-ano-texto").innerText = `${mesesNomes[mesAtual]} ${anoAtual}`;
    atualizarBotoesMes();
    
    const grid = document.getElementById("grade-dias");
    grid.innerHTML = `<div class="dia-semana">Seg</div><div class="dia-semana">Ter</div><div class="dia-semana">Qua</div><div class="dia-semana">Qui</div><div class="dia-semana">Sex</div>`;

    let primeiroDia = new Date(anoAtual, mesAtual, 1).getDay();
    let espacosVazios = 0;
    if (primeiroDia >= 1 && primeiroDia <= 5) espacosVazios = primeiroDia - 1;
    else if (primeiroDia === 0 || primeiroDia === 6) espacosVazios = 0; 

    for (let i = 0; i < espacosVazios; i++) grid.innerHTML += `<div class="dia vazio"></div>`;

    let diasNoMes = new Date(anoAtual, mesAtual + 1, 0).getDate();
    for (let dia = 1; dia <= diasNoMes; dia++) {
        let dataReal = new Date(anoAtual, mesAtual, dia); 
        let diaSemana = dataReal.getDay(); 
        if (diaSemana === 0 || diaSemana === 6) continue;

        let divDia = document.createElement("div"); divDia.className = "dia";
        divDia.innerHTML = `<div class="dia-numero">${dia < 10 ? "0"+dia : dia}</div>`;
        
        let dataFormatadaStr = `${dia < 10 ? '0'+dia : dia}/${mesAtual < 9 ? '0'+(mesAtual+1) : (mesAtual+1)}/${anoAtual}`;
        
        if (diaSemana === 3) divDia.innerHTML += `<div class="prof-fixo">Prof. Lian<br>07:00 às 11:25</div>`;
        else if (diaSemana === 4) divDia.innerHTML += `<div class="prof-fixo">Prof. Lian<br>08:40 às 11:25</div>`;

        let qtdMatutino = 0; let qtdVespertino = 0;
        let agDoDia = todosAgendamentosCache.filter(ag => ag.diaNum === dia && ag.mesNum === mesAtual && ag.anoNum === anoAtual);
        
        agDoDia.forEach(ag => { 
            ag.horarios.forEach(h => {
                if (h.includes("Vesp")) qtdVespertino++;
                else qtdMatutino++;
            });
        });

        let qtdTotal = qtdMatutino + qtdVespertino;
        if (qtdTotal >= 10) { 
            divDia.innerHTML += `<div class="reserve-agora" style="color:#d32f2f;">🔴 Lotado</div>`; divDia.style.backgroundColor = "#ffebee"; 
        } 
        else if (qtdMatutino >= 5 || qtdVespertino >= 5 || qtdTotal >= 5) { 
            divDia.innerHTML += `<div class="reserve-agora" style="color:#d32f2f;">🔴 Lotado</div>`; 
        } 

        // REDIRECIONA PARA A NOVA PÁGINA PASSANDO A DATA NA URL
        divDia.onclick = () => { window.location.href = `agendar.html?data=${encodeURIComponent(dataFormatadaStr)}`; };
        grid.appendChild(divDia);
    }
}

// ================= FORMULÁRIO DE RESERVAS (agendar.html) =================
function carregarLogicaFormulario() {
    document.querySelectorAll('.horario-item').forEach(lbl => { lbl.classList.remove('bloqueado', 'bloqueado-proerd'); lbl.querySelector('input').disabled = false; lbl.querySelector('input').checked = false; });

    let dataDeTrabalho = "";
    
    // Se for modo de EDIÇÃO
    if (idEditUrl) {
        let ag = todosAgendamentosCache.find(a => a.id === idEditUrl);
        if(!ag) { alert("Agendamento não encontrado."); window.location.href = 'index.html'; return; }
        
        dataDeTrabalho = ag.data;
        document.getElementById("data-selecionada-texto").innerText = dataDeTrabalho + " (MODO DE EDIÇÃO)";
        document.getElementById("nome").value = ag.nomeProfessor === "🔒 BLOQUEADO" ? "" : ag.nomeProfessor;
        document.getElementById("telefone").value = ag.telefone === "-" ? "" : ag.telefone;
        document.getElementById("disciplina").value = ag.disciplina === "Fechado" ? "" : ag.disciplina;
        document.getElementById("descricao").value = ag.descricaoAula;
        document.getElementById("btn-salvar").innerHTML = "💾 SALVAR ALTERAÇÕES";

        ag.horarios.forEach(hr => {
            const cb = document.querySelector(`input[name="horario"][value="${hr}"]`);
            if(cb) cb.checked = true;
        });
    } 
    // Se for NOVO agendamento
    else if (dataUrl) {
        dataDeTrabalho = dataUrl;
        document.getElementById("data-selecionada-texto").innerText = dataDeTrabalho;
    } else {
        window.location.href = 'index.html'; // Se não tiver data nem ID, volta pro início
        return;
    }

    let partes = dataDeTrabalho.split('/');
    let d = parseInt(partes[0]), m = parseInt(partes[1]) - 1, a = parseInt(partes[2]);
    
    // Lógica do PROERD no formulário - A partir de 17/04/2026
    let dataForm = new Date(a, m, d);
    let limiteProerd = new Date(2026, 3, 17); 
    if (dataForm.getDay() === 1 && dataForm >= limiteProerd) {
        ['1º Horário (07:00 - 07:50)', '2º Horário (07:50 - 08:40)', '3º Horário (08:40 - 09:30)'].forEach(hr => {
            const cb = document.querySelector(`input[name="horario"][value="${hr}"]`);
            if(cb && !cb.checked) { // Bloqueia apenas se não for ele mesmo que está agendando no edit
                cb.disabled = true;
                let item = cb.closest('.horario-item');
                item.classList.add('bloqueado', 'bloqueado-proerd');
            }
        });
    }

    // Bloqueia horários já ocupados naquele dia (excluindo ele mesmo se for edição)
    let agDoDia = todosAgendamentosCache.filter(item => item.diaNum === d && item.mesNum === m && item.anoNum === a && item.id !== idEditUrl);
    agDoDia.forEach(outroAg => {
        outroAg.horarios.forEach(hr => {
            const cb = document.querySelector(`input[name="horario"][value="${hr}"]`);
            if(cb) { cb.disabled = true; cb.closest('.horario-item').classList.add('bloqueado'); }
        });
    });
}

async function salvarNoFirebase() {
    const nome = document.getElementById("nome").value; const telefone = document.getElementById("telefone").value;
    const disciplina = document.getElementById("disciplina").value; const descricao = document.getElementById("descricao").value;
    const checkboxes = document.querySelectorAll('input[name="horario"]:checked');
    let horariosSelecionados = Array.from(checkboxes).map(cb => cb.value);

    let dataTrabalho = dataUrl || document.getElementById("data-selecionada-texto").innerText.split(" ")[0];

    if(nome.trim() === "" || horariosSelecionados.length === 0) return alert("⚠️ Preencha seu nome e selecione um horário.");

    const btn = document.getElementById("btn-salvar");
    btn.innerHTML = "⏳ Salvando..."; btn.disabled = true;

    try {
        if (idEditUrl) {
            await db.collection("agendamentos").doc(idEditUrl).update({
                data: dataTrabalho, nomeProfessor: nome, telefone: telefone, disciplina: disciplina,
                descricaoAula: descricao, horarios: horariosSelecionados
            });
            alert("✅ Alterações salvas com sucesso!");
        } else {
            await db.collection("agendamentos").add({
                data: dataTrabalho, nomeProfessor: nome, telefone: telefone, disciplina: disciplina,
                descricaoAula: descricao, horarios: horariosSelecionados, dataRegistro: firebase.firestore.FieldValue.serverTimestamp()
            });
            alert("✅ Agendamento salvo!");
        }
        window.location.href = 'index.html'; // Volta para o início
    } catch (erro) { 
        console.error(erro);
        alert("❌ Erro ao salvar."); 
        btn.innerHTML = "📅 AGENDAR AULA"; btn.disabled = false; 
    } 
}

// ================= LISTAGENS (SEMANA E MÊS) =================
let dataSemanaVisao = getSegundaFeira(new Date());
let mesTabelaGlobal = new Date().getMonth();
let anoTabelaGlobal = new Date().getFullYear();

function getSegundaFeira(d) {
    let data = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    let dia = data.getDay(); let diff = data.getDate() - dia + (dia === 0 ? -6 : 1); 
    return new Date(data.setDate(diff));
}

function mudarSemana(delta) {
    dataSemanaVisao.setDate(dataSemanaVisao.getDate() + (delta * 7));
    renderizarGradeSemanal(); 
}

function mudarMesTabela(delta) {
    mesTabelaGlobal += delta;
    if(mesTabelaGlobal > 11) { mesTabelaGlobal = 0; anoTabelaGlobal++; }
    if(mesTabelaGlobal < 0) { mesTabelaGlobal = 11; anoTabelaGlobal--; }
    renderizarTabelasMensais();
}

function toggleRelatorioMensal() {
    let sec = document.getElementById("secao-relatorio-mensal");
    sec.style.display = (sec.style.display === "none") ? "block" : "none";
    if (sec.style.display === "block") renderizarTabelasMensais();
}

function gerarHtmlSlot(horarioVal, lblVal, agendamentosDoDia) {
    let ag = agendamentosDoDia.find(a => a.horarios.includes(horarioVal));
    if (ag) {
        if (ag.nomeProfessor === "🔒 BLOQUEADO") return `<div class="slot slot-bloqueado"><b>${lblVal}</b>🚫</div>`;
        let disciplinaHTML = ag.disciplina ? `<span class="slot-disciplina">${ag.disciplina}</span>` : '';
        return `<div class="slot slot-ocupado"><b>${lblVal}</b>${ag.nomeProfessor.split(' ')[0]}${disciplinaHTML}</div>`;
    }
    return `<div class="slot slot-livre"><b>${lblVal}</b>-</div>`;
}

function renderizarGradeSemanal() {
    if(identificarPagina() !== 'visualizar') return;

    let sexta = new Date(dataSemanaVisao); sexta.setDate(sexta.getDate() + 4);
    let strSemana = `${String(dataSemanaVisao.getDate()).padStart(2,'0')}/${String(dataSemanaVisao.getMonth()+1).padStart(2,'0')} a ${String(sexta.getDate()).padStart(2,'0')}/${String(sexta.getMonth()+1).padStart(2,'0')}`;
    document.getElementById("semana-texto-publica").innerText = strSemana;
    
    let agsSemana = todosAgendamentosCache.filter(ag => ag.dataParaOrdenacao >= dataSemanaVisao && ag.dataParaOrdenacao <= sexta);

    const gridLista = document.getElementById("grade-dias-lista");
    gridLista.innerHTML = ""; let htmlGrid = "";

    // MATUTINO
    htmlGrid += `<div class="calendario-semana">`;
    htmlGrid += `<div class="dia-semana-header">SEG</div><div class="dia-semana-header">TER</div><div class="dia-semana-header">QUA</div><div class="dia-semana-header">QUI</div><div class="dia-semana-header">SEX</div>`;
    htmlGrid += `<div class="turno-merged-header">MATUTINO</div>`;

    let limiteProerd = new Date(2026, 3, 17); // 17/04/2026

    for (let h = 0; h < 5; h++) { 
        for (let d = 0; d < 5; d++) { 
            let dataDia = new Date(dataSemanaVisao); dataDia.setDate(dataDia.getDate() + d);
            let agDoDia = agsSemana.filter(ag => ag.diaNum === dataDia.getDate() && ag.mesNum === dataDia.getMonth() && ag.anoNum === dataDia.getFullYear());
            let hInfo = [
                {val: "1º Horário (07:00 - 07:50)", lbl: "1º"}, {val: "2º Horário (07:50 - 08:40)", lbl: "2º"},
                {val: "3º Horário (08:40 - 09:30)", lbl: "3º"}, {val: "4º Horário (09:45 - 10:35)", lbl: "4º"},
                {val: "5º Horário (10:35 - 11:25)", lbl: "5º"}
            ][h];
            
            if (d === 0 && h <= 2 && dataDia >= limiteProerd) htmlGrid += `<div class="slot slot-proerd"><b>${hInfo.lbl}</b>PROERD</div>`;
            else htmlGrid += gerarHtmlSlot(hInfo.val, hInfo.lbl, agDoDia);
        }
    }
    htmlGrid += `</div>`; 

    // VESPERTINO
    htmlGrid += `<details class="dropdown-vespertino" style="margin-top: 6px; border-top: none; padding-top: 0;">`;
    htmlGrid += `<summary style="background-color: #004080; color: white; font-size: 11px; font-weight: bold; text-align: center; padding: 8px 0; border-radius: 4px; cursor: pointer; list-style: none; outline: none; margin-bottom: 5px;">🌤️ Período Vespertino <span style="font-weight: normal; color: #ccc; font-size: 10px;">(Clique para expandir)</span> ▼</summary>`;
    htmlGrid += `<div class="calendario-semana">`;

    for (let h = 0; h < 5; h++) { 
        for (let d = 0; d < 5; d++) { 
            let dataDia = new Date(dataSemanaVisao); dataDia.setDate(dataDia.getDate() + d);
            let agDoDia = agsSemana.filter(ag => ag.diaNum === dataDia.getDate() && ag.mesNum === dataDia.getMonth() && ag.anoNum === dataDia.getFullYear());
            let hInfo = [
                {val: "1º Hor. Vesp (13:00 - 13:50)", lbl: "1º"}, {val: "2º Hor. Vesp (13:50 - 14:40)", lbl: "2º"},
                {val: "3º Hor. Vesp (14:40 - 15:30)", lbl: "3º"}, {val: "4º Hor. Vesp (15:45 - 16:35)", lbl: "4º"},
                {val: "5º Hor. Vesp (16:35 - 17:25)", lbl: "5º"}
            ][h];
             htmlGrid += gerarHtmlSlot(hInfo.val, hInfo.lbl, agDoDia);
        }
    }
    htmlGrid += `</div></details>`;
    gridLista.innerHTML = htmlGrid;

    let htmlSemana = "";
    if (agsSemana.length === 0) { htmlSemana = "<tr><td colspan='3' style='text-align:center;'>Nenhum agendamento nesta semana.</td></tr>"; } 
    else {
        agsSemana.forEach(ag => {
            let horOrd = ordenarHorarios(ag.horarios);
            let horStr = horOrd.map(h => formatarHorario(h)).join(", ");
            let corNome = ag.nomeProfessor.includes("BLOQUEADO") ? "color: #d32f2f;" : "color: #333;";
            let dis = ag.disciplina || "Sem disciplina";
            let diaDaSemanaTexto = diasSemanaNomes[ag.dataParaOrdenacao.getDay()];

            htmlSemana += `<tr>
                <td><span class="lbl-mobile">Data:</span> <span class="val-mobile"><strong>${ag.data}</strong><br><small style="color:#666;">(${diaDaSemanaTexto})</small></span></td>
                <td><span class="lbl-mobile">Horários:</span> <span class="val-mobile"><strong>${horStr}</strong></span></td>
                <td style="flex-direction: column; align-items: stretch;">
                    <div style="display:flex; justify-content:space-between; width:100%;">
                        <span class="lbl-mobile">Professor:</span> <span class="val-mobile"><strong style="${corNome}">${ag.nomeProfessor}</strong></span>
                    </div>
                    <div style="margin-top: 5px; text-align: left; width: 100%;">
                        <span style="color:#004080; font-size:12px; font-weight:bold;">📚 ${dis}</span><br>
                        <span style="color: #666; font-size: 13px; display:block; margin-top:5px;">${ag.descricaoAula}</span>
                    </div>
                </td>
            </tr>`;
        });
    }
    document.getElementById("corpo-tabela-semana").innerHTML = htmlSemana;
}

function renderizarTabelasMensais() {
    const page = identificarPagina();
    if(page !== 'visualizar' && page !== 'admin') return;

    const textoMesAno = `${mesesNomes[mesTabelaGlobal]} ${anoTabelaGlobal}`;
    if (document.getElementById("titulo-tabela-publica")) {
        document.getElementById("titulo-tabela-publica").innerText = `📋 Agendamentos (${textoMesAno})`;
        document.getElementById("btn-mes-tabela-ant").innerText = "< " + mesesNomes[mesTabelaGlobal - 1 < 0 ? 11 : mesTabelaGlobal - 1].substring(0,3);
        document.getElementById("btn-mes-tabela-prox").innerText = mesesNomes[mesTabelaGlobal + 1 > 11 ? 0 : mesTabelaGlobal + 1].substring(0,3) + " >";
    }
    if (document.getElementById("titulo-tabela-admin")) {
        document.getElementById("titulo-tabela-admin").innerText = textoMesAno;
    }

    let agsMes = todosAgendamentosCache.filter(ag => ag.mesNum === mesTabelaGlobal && ag.anoNum === anoTabelaGlobal);
    let htmlGerado = "";

    if (agsMes.length === 0) {
        htmlGerado = page === 'admin' ? "<tr><td colspan='5' style='text-align:center;'>Nenhum agendamento neste mês.</td></tr>" : "<tr><td colspan='3' style='text-align:center;'>Nenhum agendamento neste mês.</td></tr>";
    } else {
        agsMes.forEach(ag => {
            let horOrd = ordenarHorarios(ag.horarios);
            let horStr = horOrd.map(h => formatarHorario(h)).join(", ");
            let corNome = ag.nomeProfessor.includes("BLOQUEADO") ? "color: #d32f2f;" : "color: #333;";
            let dis = ag.disciplina || "Sem disciplina";
            let diaDaSemanaTexto = diasSemanaNomes[ag.dataParaOrdenacao.getDay()];

            if(page === 'visualizar') {
                htmlGerado += `<tr>
                    <td><span class="lbl-mobile">Data:</span> <span class="val-mobile"><strong>${ag.data}</strong><br><small style="color:#666;">(${diaDaSemanaTexto})</small></span></td>
                    <td><span class="lbl-mobile">Horários:</span> <span class="val-mobile"><strong>${horStr}</strong></span></td>
                    <td style="flex-direction: column; align-items: stretch;">
                        <div style="display:flex; justify-content:space-between; width:100%;"><span class="lbl-mobile">Professor:</span><span class="val-mobile"><strong style="${corNome}">${ag.nomeProfessor}</strong></span></div>
                        <div style="margin-top: 5px; text-align: left; width: 100%;"><span style="color:#004080; font-size:12px; font-weight:bold;">📚 ${dis}</span><br><span style="color: #666; font-size: 13px; display:block; margin-top:5px;">${ag.descricaoAula}</span></div>
                    </td>
                </tr>`;
            } else if (page === 'admin') {
                htmlGerado += `<tr>
                    <td><span class="lbl-mobile">Data:</span> <span class="val-mobile"><strong>${ag.data}</strong><br><small style="color:#666;">(${diaDaSemanaTexto})</small></span></td>
                    <td><span class="lbl-mobile">Horários:</span> <span class="val-mobile"><strong>${horStr}</strong></span></td>
                    <td><span class="lbl-mobile">Professor:</span> <span class="val-mobile"><strong style="${corNome}">${ag.nomeProfessor}</strong><br><small>${ag.telefone || ''} | ${dis}</small></span></td>
                    <td><span class="lbl-mobile">Descrição:</span> <span class="val-mobile" style="text-align:left;">${ag.descricaoAula}</span></td>
                    <td class="td-acoes"><button class="btn-editar" onclick="editarReserva('${ag.id}')">✏️ Editar</button><button class="btn-excluir" onclick="excluirReserva('${ag.id}')">🗑️ Excluir</button></td>
                </tr>`;
            }
        });
    }

    if(page === 'visualizar' && document.getElementById("corpo-tabela-publica")) document.getElementById("corpo-tabela-publica").innerHTML = htmlGerado;
    if(page === 'admin' && document.getElementById("corpo-tabela-admin")) document.getElementById("corpo-tabela-admin").innerHTML = htmlGerado;
}

// ================= SINCRONIZAÇÃO EM TEMPO REAL =================
window.onload = () => { 
    // Proteção de segurança da página admin
    if (identificarPagina() === 'admin' && sessionStorage.getItem("adminAutorizado") !== "true") {
        window.location.href = "index.html"; // Joga de volta pra tela inicial se não estiver logado
        return;
    }

    db.collection("agendamentos").onSnapshot((snapshot) => {
        todosAgendamentosCache = [];
        snapshot.forEach(doc => {
            let ag = doc.data(); ag.id = doc.id;
            let partes = ag.data.split('/');
            if(partes.length === 3) {
                ag.diaNum = parseInt(partes[0]); ag.mesNum = parseInt(partes[1]) - 1; ag.anoNum = parseInt(partes[2]);
                ag.dataParaOrdenacao = new Date(ag.anoNum, ag.mesNum, ag.diaNum);
            }
            todosAgendamentosCache.push(ag);
        });
        todosAgendamentosCache.sort((a, b) => a.dataParaOrdenacao - b.dataParaOrdenacao);

        // Dispara apenas as funções necessárias para a página atual
        const paginaAtual = identificarPagina();
        if (paginaAtual === 'index') gerarCalendario();
        else if (paginaAtual === 'visualizar') { renderizarGradeSemanal(); renderizarTabelasMensais(); }
        else if (paginaAtual === 'admin') renderizarTabelasMensais();
        else if (paginaAtual === 'agendar') carregarLogicaFormulario();

    }, (error) => { console.error("Erro na sincronização em tempo real: ", error); });
};
